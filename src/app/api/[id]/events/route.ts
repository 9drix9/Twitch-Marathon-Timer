import { NextRequest, NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/timer";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const events = await getRecentEvents(id);
  return NextResponse.json(events);
}
