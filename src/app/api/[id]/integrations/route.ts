import { NextRequest, NextResponse } from "next/server";
import { redis, keys } from "@/lib/db";
import { verifyAdmin } from "@/lib/auth";

interface Integrations {
  streamelements_jwt?: string;
  streamlabs_token?: string;
}

async function parseIntegrations(id: string): Promise<Integrations> {
  const stored = await redis().get(keys(id).integrations);
  if (!stored) return {};
  if (typeof stored === "string") return JSON.parse(stored);
  return stored as Integrations;
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
  if (!(await verifyAdmin(id, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const integrations = await parseIntegrations(id);

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
  if (!(await verifyAdmin(id, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { streamelements_jwt, streamlabs_token } = body;

  const current = await parseIntegrations(id);

  if (streamelements_jwt !== undefined) {
    current.streamelements_jwt = streamelements_jwt;
  }
  if (streamlabs_token !== undefined) {
    current.streamlabs_token = streamlabs_token;
  }

  await redis().set(keys(id).integrations, current);

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
  if (!(await verifyAdmin(id, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await redis().del(keys(id).integrations);
  return NextResponse.json({ ok: true });
}
