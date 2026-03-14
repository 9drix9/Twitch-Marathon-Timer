import { NextResponse } from "next/server";
import crypto from "crypto";
import { redis, keys } from "@/lib/db";

export async function POST() {
  const id = crypto.randomBytes(6).toString("hex"); // 12-char hex ID
  const admin_secret = crypto.randomBytes(16).toString("hex"); // 32-char hex secret
  const k = keys(id);

  const startMs = parseInt(process.env.TIMER_START_SECONDS || "86400", 10) * 1000;

  await redis().set(k.timerState, {
    end_time: 0,
    remaining_ms: startMs,
    is_paused: true,
    max_cap_ms: 172800000,
  });

  await redis().set(k.meta, {
    created_at: new Date().toISOString(),
    admin_secret,
  });

  return NextResponse.json({ id, admin_secret });
}
