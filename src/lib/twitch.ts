import { redis, keys, SHARED_KEYS } from "./db";
import crypto from "crypto";

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2";
const TWITCH_API_URL = "https://api.twitch.tv/helix";

// ── Types ───────────────────────────────────────────

export interface TwitchConnection {
  user_id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  connected_at: string;
}

// ── Connection ──────────────────────────────────────

export async function getTwitchConnection(id: string): Promise<TwitchConnection | null> {
  return await redis().get<TwitchConnection>(keys(id).twitchConnection);
}

export async function saveTwitchConnection(id: string, conn: TwitchConnection): Promise<void> {
  await redis().set(keys(id).twitchConnection, conn);
}

export async function removeTwitchConnection(id: string): Promise<void> {
  await redis().del(keys(id).twitchConnection);
}

// ── OAuth state (CSRF protection) ───────────────────

export async function createOAuthState(id: string): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex");
  // Store state with the timer ID embedded so callback knows which timer
  await redis().set(keys(id).twitchOAuthState, state, { ex: 600 });
  // Also store reverse mapping: state -> timer ID
  await redis().set(`marathon:oauth_state:${state}`, id, { ex: 600 });
  return state;
}

export async function verifyOAuthState(state: string): Promise<string | null> {
  // Returns the timer ID if valid, null otherwise
  const timerId = await redis().get<string>(`marathon:oauth_state:${state}`);
  if (!timerId) return null;
  const stored = await redis().get<string>(keys(timerId).twitchOAuthState);
  if (!stored || stored !== state) return null;
  await redis().del(keys(timerId).twitchOAuthState);
  await redis().del(`marathon:oauth_state:${state}`);
  return timerId;
}

// ── App access token (cached, shared) ───────────────

export async function getAppAccessToken(): Promise<string> {
  const cached = await redis().get<{ token: string; expires_at: number }>(
    SHARED_KEYS.appToken
  );
  if (cached && cached.expires_at > Date.now()) return cached.token;

  const res = await fetch(`${TWITCH_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get app access token");

  await redis().set(SHARED_KEYS.appToken, {
    token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 120) * 1000,
  });

  return data.access_token;
}

// ── Webhook secret (per-timer, auto-generated) ─────

export async function getWebhookSecret(timerId: string): Promise<string> {
  let secret = await redis().get<string>(keys(timerId).webhookSecret);
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    await redis().set(keys(timerId).webhookSecret, secret);
  }
  return secret;
}

// ── Exchange OAuth code for user info ────────────────

export async function exchangeCodeForUser(
  code: string,
  redirectUri: string
): Promise<TwitchConnection> {
  const tokenRes = await fetch(`${TWITCH_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.message || "Failed to exchange code for token");
  }

  const userRes = await fetch(`${TWITCH_API_URL}/users`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
  });

  const userData = await userRes.json();
  const user = userData.data?.[0];
  if (!user) throw new Error("Failed to fetch user info");

  return {
    user_id: user.id,
    login: user.login,
    display_name: user.display_name,
    profile_image_url: user.profile_image_url,
    connected_at: new Date().toISOString(),
  };
}

// ── EventSub subscriptions ──────────────────────────

const EVENT_TYPES = [
  {
    type: "channel.subscribe",
    version: "1",
    label: "Subscriptions",
    condition: (uid: string) => ({ broadcaster_user_id: uid }),
  },
  {
    type: "channel.subscription.message",
    version: "1",
    label: "Resubs",
    condition: (uid: string) => ({ broadcaster_user_id: uid }),
  },
  {
    type: "channel.subscription.gift",
    version: "1",
    label: "Gift Subs",
    condition: (uid: string) => ({ broadcaster_user_id: uid }),
  },
  {
    type: "channel.cheer",
    version: "1",
    label: "Bits / Cheers",
    condition: (uid: string) => ({ broadcaster_user_id: uid }),
  },
  {
    type: "channel.raid",
    version: "1",
    label: "Raids",
    condition: (uid: string) => ({ to_broadcaster_user_id: uid }),
  },
  {
    type: "channel.follow",
    version: "2",
    label: "Follows",
    condition: (uid: string) => ({
      broadcaster_user_id: uid,
      moderator_user_id: uid,
    }),
  },
  {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    label: "Channel Points",
    condition: (uid: string) => ({ broadcaster_user_id: uid }),
  },
];

export async function createAllSubscriptions(
  timerId: string,
  broadcasterUserId: string,
  baseUrl: string
): Promise<{ created: string[]; errors: string[] }> {
  const appToken = await getAppAccessToken();
  const secret = await getWebhookSecret(timerId);
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const callbackUrl = `${baseUrl}/api/webhooks/twitch/${timerId}`;

  const created: string[] = [];
  const errors: string[] = [];

  for (const sub of EVENT_TYPES) {
    const res = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Client-Id": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: sub.type,
        version: sub.version,
        condition: sub.condition(broadcasterUserId),
        transport: {
          method: "webhook",
          callback: callbackUrl,
          secret,
        },
      }),
    });

    if (res.ok || res.status === 409) {
      created.push(sub.label);
    } else {
      const err = await res.json().catch(() => ({}));
      const msg = (err as Record<string, string>).message || String(res.status);
      // "max subscriptions" means it already exists — treat as success
      if (msg.includes("maximum") || msg.includes("already exists")) {
        created.push(sub.label);
      } else {
        errors.push(`${sub.label}: ${msg}`);
      }
    }
  }

  return { created, errors };
}

export async function deleteAllSubscriptions(): Promise<void> {
  try {
    const appToken = await getAppAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID!;
    const res = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Client-Id": clientId,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    for (const sub of data.data || []) {
      await fetch(
        `${TWITCH_API_URL}/eventsub/subscriptions?id=${sub.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": clientId,
          },
        }
      );
    }
  } catch {}
}
