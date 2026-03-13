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
  const body = await req.json();
  const { action, ms } = body;

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
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const state = await getTimerState(id);
  return NextResponse.json(state);
}
