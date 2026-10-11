import { NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const email = typeof body === "object" && body !== null && "email" in body ? body.email : null;
  const code = typeof body === "object" && body !== null && "code" in body ? body.code : null;
  if (typeof email !== "string" || !emailPattern.test(email) || typeof code !== "string" || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json({ message: "邮箱或验证码格式不正确。" }, { status: 400 });
  }

  const baseUrl = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, code }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return NextResponse.json({ message: "验证码无效或已过期。" }, { status: response?.status ?? 503 });

  const tokenResponse: unknown = await response.json().catch(() => null);
  const accessToken = typeof tokenResponse === "object" && tokenResponse !== null && "access_token" in tokenResponse ? tokenResponse.access_token : null;
  if (typeof accessToken !== "string" || accessToken.length < 10) return NextResponse.json({ message: "登录服务返回了无效响应。" }, { status: 502 });

  const result = new NextResponse(null, { status: 204 });
  result.cookies.set("aigc_session", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return result;
}
