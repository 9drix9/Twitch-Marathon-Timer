import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState, exchangeCodeForUser, saveTwitchConnection, createAllSubscriptions } from "@/lib/twitch";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }

  // Verify state and get timer ID
  const timerId = await verifyOAuthState(state);
  if (!timerId) {
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }

  try {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "";
    const redirectUri = `${proto}://${host}/api/auth/twitch/callback`;

    const user = await exchangeCodeForUser(code, redirectUri);
    await saveTwitchConnection(timerId, user);

    // Create EventSub subscriptions
    const baseUrl = `${proto}://${host}`;
    await createAllSubscriptions(timerId, user.user_id, baseUrl);

    return NextResponse.redirect(new URL(`/${timerId}/admin?twitch=connected`, req.url));
  } catch (err) {
    console.error("Twitch OAuth error:", err);
    return NextResponse.redirect(new URL(`/${timerId}/admin?twitch=error`, req.url));
  }
}
