import { NextRequest, NextResponse } from "next/server";
import { getRules, saveRules } from "@/config/time-rules";
import { redis, keys } from "@/lib/db";

const DEFAULT_OVERLAY_SETTINGS = {
  enabled_events: {
    subs: true,
    bits: true,
    donations: true,
    follows: false,
    raids: true,
    channel_points: true,
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "overlay") {
    const stored = await redis().get(keys(id).overlaySettings);
    const settings = stored
      ? (typeof stored === "string" ? JSON.parse(stored) : stored)
      : DEFAULT_OVERLAY_SETTINGS;
    return NextResponse.json(settings);
  }

  const rules = await getRules(id);
  return NextResponse.json(rules);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();

  if (body.type === "overlay") {
    const { type, ...settings } = body;
    const existing = await redis().get(keys(id).overlaySettings);
    const current = existing
      ? (typeof existing === "string" ? JSON.parse(existing) : existing)
      : DEFAULT_OVERLAY_SETTINGS;
    const merged = { ...current, ...settings };
    await redis().set(keys(id).overlaySettings, JSON.stringify(merged));
    return NextResponse.json(merged);
  }

  const rules = await saveRules(id, body);
  return NextResponse.json(rules);
}
