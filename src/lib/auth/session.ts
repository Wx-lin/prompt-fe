import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/api/client";
import type { CurrentUser } from "@/types/prompt";

export const sessionCookieName = "aigc_session";

/** Reads the raw session token from the HttpOnly cookie, if present. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName)?.value ?? null;
}

/**
 * Resolves the currently logged-in user for the request, or null when there is no
 * session cookie or the backend rejects the token (e.g. expired). Never throws —
 * callers should treat a null result the same as "signed out".
 */
export async function getSessionUser(): Promise<CurrentUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return getCurrentUser(token);
}
