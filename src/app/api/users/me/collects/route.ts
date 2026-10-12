import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session";
import { getMyCollects } from "@/lib/api/client";

/**
 * Thin BFF proxy so the client-side infinite-scroll loader on the collections page can
 * request additional pages without exposing the upstream API base URL or the session
 * token to the browser.
 */
export async function GET(request: Request): Promise<Response> {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "未登录。" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("page_size") ?? "20") || 20;

  try {
    const feed = await getMyCollects(token, { page, pageSize });
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json({ error: "Failed to load collections" }, { status: 502 });
  }
}
