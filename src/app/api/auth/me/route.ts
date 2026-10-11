import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

/** Thin BFF proxy: resolves the current user from the HttpOnly session cookie. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "未登录。" }, { status: 401 });
  return NextResponse.json(user);
}
