import { NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const email = typeof body === "object" && body !== null && "email" in body ? body.email : null;
  if (typeof email !== "string" || !emailPattern.test(email)) {
    return NextResponse.json({ message: "请输入有效邮箱地址。" }, { status: 400 });
  }

  const baseUrl = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) return NextResponse.json({ message: "暂时无法发送验证码。" }, { status: response?.status ?? 503 });
  return new NextResponse(null, { status: 204 });
}
