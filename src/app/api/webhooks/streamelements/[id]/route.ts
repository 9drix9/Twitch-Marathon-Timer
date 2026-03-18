import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/db";
import { processEvent } from "@/lib/timer";
import { getRules, computeTimeForEvent } from "@/config/time-rules";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // Verify the token is configured
  const stored = await redis().get(keys(id).integrations);
  const integrations = typeof stored === "string" ? JSON.parse(stored) : stored;
  if (!integrations?.streamelements_jwt) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // StreamElements sends tip events with type "tip"
  if (data.type !== "tip" && data.type !== "donation") {
    return NextResponse.json({ ok: true });
  }

  const amount = data.data?.amount || data.amount || 0;
  if (amount <= 0) return NextResponse.json({ ok: true });

  const rules = await getRules(id);
  const timeMs = computeTimeForEvent("donation", rules, { amount });
  const username = data.data?.username || data.username || "Anonymous";

  await processEvent(id, {
    event_id: `se_${data._id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: "streamelements",
    type: "donation",
    detail: { user: username, amount, currency: data.data?.currency || "USD" },
    time_added_ms: timeMs,
  });

  return NextResponse.json({ ok: true });
}
