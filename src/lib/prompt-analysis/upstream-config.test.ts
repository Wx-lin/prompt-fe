// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as upload } from "@/app/api/prompt-assets/route";
import { GET as asset } from "@/app/api/prompt-assets/[id]/route";
import { GET as analyses, POST as createAnalysis } from "@/app/api/prompt-analyses/route";
import { GET as analysis, PATCH as edit, DELETE as removeAnalysis } from "@/app/api/prompt-analyses/[id]/route";
import { GET as conversations, POST as createConversation } from "@/app/api/prompt-conversations/route";
import { GET as conversation, DELETE as removeConversation } from "@/app/api/prompt-conversations/[id]/route";
import { POST as send } from "@/app/api/prompt-conversations/[id]/messages/route";
import { POST as retry } from "@/app/api/prompt-conversations/[id]/retry/route";
import { POST as importReference } from "@/app/api/prompt-assets/from-prompt/route";
import { POST as sendCode } from "@/app/api/auth/send-code/route";
import { POST as verifyCode } from "@/app/api/auth/verify-code/route";
import { POST as google } from "@/app/api/auth/google/route";
import { getCurrentUser, getMyCollects, getPromptFeed } from "@/lib/api/client";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "private-session") }));
const ID = "00000000-0000-4000-8000-000000000001";
const KEY = "00000000-0000-4000-8000-000000000002";
const PRIMARY = "http://public-api.example";
const CREATION = "http://creation-api.example";
const context = () => ({ params: Promise.resolve({ id: ID }) });
const request = (method = "GET", body?: unknown, headers: HeadersInit = {}) => new Request("http://localhost/api/prompt-conversations", {
  method, headers: { origin: "http://localhost", "content-type": "application/json", "idempotency-key": KEY, ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function uploadRequest() {
  const form = new FormData(); form.append("file", new File(["png"], "cat.png", { type: "image/png" }));
  return new Request("http://localhost/api/prompt-assets", { method: "POST", headers: { origin: "http://localhost" }, body: form });
}
function unavailableUpstream() {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "private deployment details" } }, { status: 503 })));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", PRIMARY);
  vi.stubEnv("PROMPT_CREATION_API_BASE_URL", undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("server-only prompt creation upstream", () => {
  const routes = [
    ["upload", "prompt-assets", () => upload(uploadRequest())],
    ["asset", `prompt-assets/${ID}`, () => asset(request(), context())],
    ["create analysis", "prompt-analyses", () => createAnalysis(request("POST", { asset_id: ID }))],
    ["analysis history", "prompt-analyses?limit=20", () => analyses(request())],
    ["analysis detail", `prompt-analyses/${ID}`, () => analysis(request(), context())],
    ["edit analysis", `prompt-analyses/${ID}`, () => edit(request("PATCH", { revision: 0, prompt: { zh: "猫", en: "cat" } }), context())],
    ["delete analysis", `prompt-analyses/${ID}`, () => removeAnalysis(request("DELETE"), context())],
    ["create conversation", "prompt-conversations", () => createConversation(request("POST", { message: "cat" }))],
    ["conversation history", "prompt-conversations?limit=20", () => conversations(request())],
    ["conversation detail", `prompt-conversations/${ID}`, () => conversation(request(), context())],
    ["send follow-up", `prompt-conversations/${ID}/messages`, () => send(request("POST", { message: "daylight", parent_analysis_id: ID, parent_revision: 0 }), context())],
    ["retry turn", `prompt-conversations/${ID}/retry`, () => retry(request("POST", { analysis_id: ID }), context())],
    ["delete conversation", `prompt-conversations/${ID}`, () => removeConversation(request("DELETE"), context())],
    ["gallery reference", "prompt-assets/from-prompt", () => importReference(request("POST", { prompt_id: ID }))],
  ] as const;

  it.each(routes)("routes %s to the server-only override without exposing configuration", async (_name, path, invoke) => {
    vi.stubEnv("PROMPT_CREATION_API_BASE_URL", `${CREATION}/`);
    const fetcher = unavailableUpstream();
    const response = await invoke();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(`${CREATION}/api/${path}`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer private-session" }, redirect: "manual", cache: "no-store" });
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const visible = JSON.stringify(await response.json());
    for (const privateValue of [PRIMARY, CREATION, "private-session", "private deployment details"]) expect(visible).not.toContain(privateValue);
  });

  it.each([[PRIMARY, undefined], [PRIMARY, ""], [PRIMARY, " \t "], [undefined, undefined]])("keeps the existing API_BASE_URL fallback (%s, override %s)", async (base, override) => {
    vi.stubEnv("API_BASE_URL", base);
    vi.stubEnv("PROMPT_CREATION_API_BASE_URL", override);
    const fetcher = unavailableUpstream();
    await conversation(request(), context());
    expect(fetcher.mock.calls[0][0]).toBe(`${base ?? "http://localhost:8000"}/api/prompt-conversations/${ID}`);
  });

  it("ignores browser headers and public configuration when selecting the private upstream", async () => {
    vi.stubEnv("NEXT_PUBLIC_PROMPT_CREATION_API_BASE_URL", "https://untrusted.example");
    const fetcher = unavailableUpstream();
    await createConversation(request("POST", { message: "cat" }, { "x-prompt-creation-api-base-url": "https://untrusted.example", "x-api-base-url": "https://untrusted.example" }));
    expect(fetcher.mock.calls[0][0]).toBe(`${PRIMARY}/api/prompt-conversations`);
    expect(JSON.stringify(fetcher.mock.calls[0][1])).not.toContain("untrusted.example");
    fetcher.mockClear();
    expect((await createConversation(request("POST", { message: "cat", api_base_url: "https://untrusted.example" }))).status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("leaves public gallery, account, collections and login traffic on the ordinary API", async () => {
    vi.stubEnv("PROMPT_CREATION_API_BASE_URL", CREATION);
    const fetcher = unavailableUpstream();
    await getPromptFeed().catch(() => null);
    await getCurrentUser("private-session");
    await getMyCollects("private-session").catch(() => null);
    await sendCode(request("POST", { email: "person@example.com" }));
    await verifyCode(request("POST", { email: "person@example.com", code: "123456" }));
    await google(request("POST", { id_token: "invalid-test-credential" }));
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      `${PRIMARY}/api/prompts?page=1&page_size=20&sort=recommended`, `${PRIMARY}/api/auth/me`,
      `${PRIMARY}/api/users/me/collects?page=1&page_size=20`, `${PRIMARY}/api/auth/send-code`,
      `${PRIMARY}/api/auth/verify-code`, `${PRIMARY}/api/auth/google`,
    ]);
  });
});
