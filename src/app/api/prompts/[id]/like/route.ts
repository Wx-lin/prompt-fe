import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session";

function getApiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

async function forward(method: "POST" | "DELETE", id: string): Promise<Response> {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "未登录。" }, { status: 401 });

  const response = await fetch(`${getApiBaseUrl()}/api/prompts/${encodeURIComponent(id)}/like`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);

  if (!response) return NextResponse.json({ message: "点赞服务暂时不可用。" }, { status: 503 });
  if (!response.ok) return NextResponse.json({ message: "操作失败，请重试。" }, { status: response.status });
  return new NextResponse(null, { status: 204 });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward("POST", id);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward("DELETE", id);
}
