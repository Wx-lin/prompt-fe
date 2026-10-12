import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const idToken = typeof body === "object" && body !== null && "id_token" in body ? body.id_token : null;
  if (typeof idToken !== "string" || idToken.length < 10) {
    return NextResponse.json({ message: "缺少有效的 Google id_token。" }, { status: 400 });
  }

  const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id_token: idToken }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) {
    const msg = response?.status === 400 ? "Google 登录凭证无效，请重试。" : "Google 登录服务暂时不可用。";
    return NextResponse.json({ message: msg }, { status: response?.status ?? 503 });
  }

  const tokenResponse: unknown = await response.json().catch(() => null);
  const accessToken =
    typeof tokenResponse === "object" && tokenResponse !== null && "access_token" in tokenResponse
      ? tokenResponse.access_token
      : null;
  if (typeof accessToken !== "string" || accessToken.length < 10) {
    return NextResponse.json({ message: "登录服务返回了无效响应。" }, { status: 502 });
  }

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
