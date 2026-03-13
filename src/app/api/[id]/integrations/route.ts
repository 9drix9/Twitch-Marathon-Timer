import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/db";

interface Integrations {
  streamelements_jwt?: string;
  streamlabs_token?: string;
}

function maskToken(token: string | undefined): string | null {
  if (!token) return null;
  if (token.length <= 4) return "****";
  return "****" + token.slice(-4);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const stored = await redis().get(keys(id).integrations);
  const integrations: Integrations = stored
    ? (typeof stored === "string" ? JSON.parse(stored) : stored)
    : {};

  return NextResponse.json({
    streamelements_jwt: maskToken(integrations.streamelements_jwt),
    streamlabs_token: maskToken(integrations.streamlabs_token),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();
  const { streamelements_jwt, streamlabs_token } = body;

  const existing = await redis().get(keys(id).integrations);
  const current: Integrations = existing
    ? (typeof existing === "string" ? JSON.parse(existing) : existing)
    : {};

  if (streamelements_jwt !== undefined) {
    current.streamelements_jwt = streamelements_jwt;
  }
  if (streamlabs_token !== undefined) {
    current.streamlabs_token = streamlabs_token;
  }

  await redis().set(keys(id).integrations, JSON.stringify(current));

  return NextResponse.json({
    streamelements_jwt: maskToken(current.streamelements_jwt),
    streamlabs_token: maskToken(current.streamlabs_token),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  await redis().del(keys(id).integrations);
  return NextResponse.json({ ok: true });
}
