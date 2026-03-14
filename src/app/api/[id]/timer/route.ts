import { NextRequest, NextResponse } from "next/server";
import {
  getTimerState,
  pauseTimer,
  resumeTimer,
  addTime,
  subtractTime,
  resetTimer,
  setMaxCap,
} from "@/lib/timer";
import { verifyAdmin } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const state = await getTimerState(id);
  return NextResponse.json(state);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!(await verifyAdmin(id, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { action, ms } = body;

  if (typeof action !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const validActions = ["pause", "resume", "add", "subtract", "reset", "set_cap"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (["add", "subtract", "reset", "set_cap"].includes(action)) {
    const msVal = action === "reset" ? (ms ?? 86400000) : ms;
    if (typeof msVal !== "number" || msVal < 0 || msVal > 604800000) {
      return NextResponse.json({ error: "Invalid ms value (0-604800000)" }, { status: 400 });
    }
  }

  switch (action) {
    case "pause":
      await pauseTimer(id);
      break;
    case "resume":
      await resumeTimer(id);
      break;
    case "add":
      await addTime(id, ms);
      break;
    case "subtract":
      await subtractTime(id, ms);
      break;
    case "reset":
      await resetTimer(id, ms ?? 86400000);
      break;
    case "set_cap":
      await setMaxCap(id, ms);
      break;
  }

  const state = await getTimerState(id);
  return NextResponse.json(state);
}
