import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/db";
import { processEvent } from "@/lib/timer";
import { getRules, computeTimeForEvent } from "@/config/time-rules";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const integrations = await redis().get<{ streamlabs_token?: string }>(keys(id).integrations);
  if (!integrations?.streamlabs_token) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Streamlabs sends an array of messages
  const messages = data.message || data.messages || [];
  if (!Array.isArray(messages)) return NextResponse.json({ ok: true });

  const rules = await getRules(id);

  for (const msg of messages) {
    const amount = parseFloat(msg.amount) || 0;
    if (amount <= 0) continue;

    const timeMs = computeTimeForEvent("donation", rules, { amount });

    await processEvent(id, {
      event_id: `sl_${msg.id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source: "streamlabs",
      type: "donation",
      detail: { user: msg.name || "Anonymous", amount, currency: msg.currency || "USD" },
      time_added_ms: timeMs,
    });
  }

  return NextResponse.json({ ok: true });
}
