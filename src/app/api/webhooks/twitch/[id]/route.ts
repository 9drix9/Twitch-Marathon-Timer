import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getWebhookSecret } from "@/lib/twitch";
import { processEvent } from "@/lib/timer";
import { getRules, computeTimeForEvent } from "@/config/time-rules";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.text();

  // Verify signature (per-timer secret)
  const secret = await getWebhookSecret(id);
  const msgId = req.headers.get("twitch-eventsub-message-id") || "";
  const timestamp = req.headers.get("twitch-eventsub-message-timestamp") || "";
  const sig = req.headers.get("twitch-eventsub-message-signature") || "";

  const hmac = crypto.createHmac("sha256", secret)
    .update(msgId + timestamp + body)
    .digest("hex");

  if (sig !== `sha256=${hmac}`) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const data = JSON.parse(body);
  const messageType = req.headers.get("twitch-eventsub-message-type");

  // Handle verification challenge
  if (messageType === "webhook_callback_verification") {
    return new NextResponse(data.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Handle revocation
  if (messageType === "revocation") {
    return NextResponse.json({ ok: true });
  }

  // Handle notification
  const event = data.event;
  const subType = data.subscription?.type;
  if (!event || !subType) return NextResponse.json({ ok: true });

  const rules = await getRules(id);
  let eventType = "";
  let meta: Record<string, unknown> = {};

  switch (subType) {
    case "channel.subscribe":
      const tierMap: Record<string, string> = { "1000": "sub_tier1", "2000": "sub_tier2", "3000": "sub_tier3" };
      eventType = tierMap[event.tier] || "sub_tier1";
      meta = { user: event.user_name, tier: event.tier };
      break;
    case "channel.subscription.gift":
      eventType = "gifted_sub";
      meta = { user: event.user_name, count: event.total || 1 };
      break;
    case "channel.cheer":
      eventType = "bits";
      meta = { user: event.user_name, bits: event.bits || 0 };
      break;
    case "channel.raid":
      eventType = "raid";
      meta = { user: event.from_broadcaster_user_name, viewers: event.viewers || 0 };
      break;
    case "channel.follow":
      eventType = "follow";
      meta = { user: event.user_name };
      break;
    case "channel.channel_points_custom_reward_redemption.add":
      eventType = "custom_reward";
      meta = { user: event.user_name, reward_id: event.reward?.id, reward_title: event.reward?.title };
      break;
    default:
      return NextResponse.json({ ok: true });
  }

  const timeMs = computeTimeForEvent(eventType, rules, meta);

  await processEvent(id, {
    event_id: `twitch_${msgId}`,
    source: "twitch",
    type: eventType,
    detail: meta,
    time_added_ms: timeMs,
  });

  return NextResponse.json({ ok: true });
}
