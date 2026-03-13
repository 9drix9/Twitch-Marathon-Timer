import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis({
    url: (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)!,
    token: (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)!,
  });
  return _redis;
}

// ── Per-timer key names ─────────────────────────────
export function keys(id: string) {
  return {
    timerState: `mt:${id}:timer`,
    events: `mt:${id}:events`,
    eventsSeen: `mt:${id}:events:seen`,
    settings: `mt:${id}:settings`,
    meta: `mt:${id}:meta`,
    twitchConnection: `mt:${id}:twitch:connection`,
    twitchOAuthState: `mt:${id}:twitch:oauth_state`,
    integrations: `mt:${id}:integrations`,
    overlaySettings: `mt:${id}:overlay_settings`,
  } as const;
}

// ── Shared keys (not per-timer) ─────────────────────
export const SHARED_KEYS = {
  appToken: "marathon:twitch:app_token",
  webhookSecret: "marathon:twitch:webhook_secret",
} as const;
