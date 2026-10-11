import { NextResponse } from "next/server";
import { getPromptFeed, searchPrompts } from "@/lib/api/client";

/**
 * Thin BFF proxy so the client-side infinite-scroll loader can request additional
 * gallery pages without exposing the upstream API base URL to the browser.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("page_size") ?? "20") || 20;
  const category = searchParams.get("category") ?? "all";
  const sort = searchParams.get("sort") ?? "latest";
  const model = searchParams.get("models") ?? "all";
  const query = searchParams.get("q")?.trim() ?? "";

  try {
    const filters = { category, sort, model, page, pageSize };
    const feed = query ? await searchPrompts(query, filters) : await getPromptFeed(filters);
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json({ error: "Failed to load prompts" }, { status: 502 });
  }
}
