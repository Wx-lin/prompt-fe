import { NextResponse } from "next/server";
import { getPromptDetail } from "@/lib/api/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Return only the public prompt text needed to prepare a gallery reference. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid prompt ID" }, { status: 400 });
  try {
    const prompt = await getPromptDetail(id);
    return NextResponse.json({ prompt_text: prompt.prompt_text }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to load prompt" }, { status: 502 });
  }
}
