import { NextRequest, NextResponse } from "next/server";
import {
  getTwitchConnection,
  createOAuthState,
  removeTwitchConnection,
  deleteAllSubscriptions,
} from "@/lib/twitch";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const connection = await getTwitchConnection(id);
  return NextResponse.json(connection);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();
  const { action } = body;

  if (action === "connect") {
    const state = await createOAuthState(id);
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host")!;
    const redirectUri = `${proto}://${host}/api/auth/twitch/callback`;
    const authUrl =
      `https://id.twitch.tv/oauth2/authorize` +
      `?client_id=${TWITCH_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=moderator:read:followers+channel:read:redemptions` +
      `&state=${state}`;
    return NextResponse.json({ url: authUrl });
  }

  if (action === "disconnect") {
    await removeTwitchConnection(id);
    await deleteAllSubscriptions();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
