import { NextRequest, NextResponse } from "next/server";
import { computeTimeForEvent, getRules } from "@/config/time-rules";
import { processEvent } from "@/lib/timer";
import { verifyAdmin } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!(await verifyAdmin(id, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, meta } = body;

  const rules = await getRules(id);
  const time_added_ms = computeTimeForEvent(type, rules, meta);

  const event_id = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const event = {
    event_id,
    source: "simulator" as const,
    type,
    detail: meta,
    time_added_ms,
  };

  await processEvent(id, event);

  return NextResponse.json(event);
}
