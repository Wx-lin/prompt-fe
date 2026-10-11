import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth/session";

/**
 * Clears the local session cookie. The backend has no dedicated logout endpoint
 * (checked docs/openapi.json as of 2026-10-09), so this only drops our own
 * HttpOnly cookie — the upstream access token simply expires on its own schedule.
 */
export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
