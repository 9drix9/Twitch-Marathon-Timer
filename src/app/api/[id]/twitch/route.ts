import { NextRequest, NextResponse } from "next/server";
import {
  getTwitchConnection,
  createOAuthState,
  removeTwitchConnection,
  deleteAllSubscriptions,
  getAppAccessToken,
  createAllSubscriptions,
} from "@/lib/twitch";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const connection = await getTwitchConnection(id);
  if (!connection) {
    return NextResponse.json({ connected: false, subscriptions: [] });
  }

  // Fetch active EventSub subscriptions for this user
  let subscriptions: { type: string; status: string }[] = [];
  try {
    const appToken = await getAppAccessToken();
    const res = await fetch(
      `https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${connection.user_id}`,
      {
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      subscriptions = (data.data || []).map(
        (s: { type: string; status: string }) => ({
          type: s.type,
          status: s.status,
        })
      );
    }
  } catch {}

  return NextResponse.json({
    connected: true,
    username: connection.display_name,
    user_id: connection.user_id,
    login: connection.login,
    subscriptions,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();
  const { action } = body;

  if (action === "connect") {
    const state = await createOAuthState(id);
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host")!;
    const redirectUri = `${proto}://${host}/api/auth/twitch/callback`;
    const authUrl =
      `https://id.twitch.tv/oauth2/authorize` +
      `?client_id=${TWITCH_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=moderator:read:followers+channel:read:redemptions` +
      `&state=${state}`;
    return NextResponse.json({ url: authUrl });
  }

  if (action === "disconnect") {
    await removeTwitchConnection(id);
    await deleteAllSubscriptions();
    return NextResponse.json({ ok: true });
  }

  if (action === "resubscribe") {
    const connection = await getTwitchConnection(id);
    if (!connection) {
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host")!;
    const baseUrl = `${proto}://${host}`;
    const result = await createAllSubscriptions(id, connection.user_id, baseUrl);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
