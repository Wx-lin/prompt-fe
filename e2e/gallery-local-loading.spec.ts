import { randomUUID } from "node:crypto";
import { expect, request as requestFactory, test, type APIRequestContext, type JSHandle, type Page } from "@playwright/test";
import messages from "../messages/zh.json";

test.skip(process.env.AIGC_PROMPT_INTEGRATION !== "1", "Requires the isolated PostgreSQL/Redis API fixture");
test.setTimeout(30_000);
test.use({ actionTimeout: 5000, navigationTimeout: 15_000 });
const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:8038";
const homeInput = messages.promptCreation.placeholder;
const followupInput = messages.promptCreation.followupPlaceholder;
const panelLabel = messages.promptCreation.panelLabel;
type Signature = { q?: string; category?: "product" | "portrait" | "avatar"; sort?: "latest" | "popular" | "hot" | "recommended"; models?: string[] };
type GateStatus = { hits: number; finished: number; released: boolean; provider_calls: number };
type ShellNodes = { header: Element | null; composer: Element | null; toolbar: Element | null; filters: Element | null; search: Element | null; panel: Element | null };

async function arm(request: APIRequestContext, signature: Signature) {
  const response = await request.post(`${fixture}/__fixture/feed-gates`, { data: signature });
  expect(response.ok()).toBe(true);
  return (await response.json()).id as string;
}
async function status(request: APIRequestContext, id: string): Promise<GateStatus> {
  const response = await request.get(`${fixture}/__fixture/feed-gates/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function release(request: APIRequestContext, id: string) {
  expect((await request.post(`${fixture}/__fixture/feed-gates/${id}/release`)).ok()).toBe(true);
}
async function remove(_request: APIRequestContext, id: string) {
  // Test-managed request contexts may already be closed after a timeout.
  const cleanup = await requestFactory.newContext({ baseURL: fixture, timeout: 5000 });
  try { expect((await cleanup.delete(`/__fixture/feed-gates/${id}`)).ok()).toBe(true); }
  finally { await cleanup.dispose(); }
}
function captureShell(page: Page): Promise<JSHandle<ShellNodes>> {
  return page.evaluateHandle(() => ({
    header: document.querySelector("[data-site-topbar]"),
    composer: document.querySelector("textarea"),
    toolbar: document.querySelector("[data-gallery-toolbar]"),
    filters: document.querySelector('[aria-label="画廊筛选"]'),
    search: document.querySelector('input[aria-label="搜索关键词"]'),
    panel: document.querySelector('aside[aria-label="提示词创作对话"]'),
  }));
}
async function sameShell(page: Page, saved: JSHandle<ShellNodes>) {
  return page.evaluate(nodes => {
    const selectors = {
      header: "[data-site-topbar]", composer: "textarea", toolbar: "[data-gallery-toolbar]",
      filters: '[aria-label="画廊筛选"]', search: 'input[aria-label="搜索关键词"]',
      panel: 'aside[aria-label="提示词创作对话"]',
    };
    return Object.entries(selectors).every(([key, selector]) => {
      const previous = nodes[key as keyof typeof nodes];
      return previous === document.querySelector(selector) && (previous === null || previous.isConnected);
    });
  }, saved);
}
const cards = (page: Page) => page.locator("[data-prompt-id]:visible");
const uniqueQuery = () => `gallery-${randomUUID()}`;

test.beforeAll(async ({ request, baseURL }) => {
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(baseURL!).hostname);
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(fixture).hostname);
  const health = await request.get(`${fixture}/health`);
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ isolated_fixture: true, worker_running: true });
});

const changes = [
  { name: "category", signature: { category: "portrait" as const }, expectedCount: 1,
    act: async (page: Page) => {
      const link = page.locator("[data-gallery-toolbar]").getByRole("link", { name: "人像写真", exact: true });
      await expect(link).toBeVisible(); await link.click();
    }, parameter: ["category", "portrait"] },
  { name: "sort", signature: { sort: "popular" as const }, expectedCount: 6,
    act: async (page: Page) => {
      await page.getByRole("combobox", { name: "排序方式", exact: true }).click();
      await page.getByRole("option", { name: "最受欢迎", exact: true }).click();
    }, parameter: ["sort", "popular"] },
  { name: "model", signature: { models: ["FLUX.1"] }, expectedCount: 6,
    act: async (page: Page) => {
      await page.getByRole("combobox", { name: "模型", exact: true }).click();
      await page.getByRole("option", { name: "FLUX.1", exact: true }).click();
    }, parameter: ["models", "FLUX.1"] },
  { name: "query", signature: {}, expectedCount: 6,
    act: async (page: Page, query: string) => {
      const input = page.getByRole("textbox", { name: "搜索关键词", exact: true });
      await input.fill(query); await input.press("Enter");
    }, parameter: ["q", ""] },
];

for (const change of changes) test(`${change.name} pending keeps the same header, composer and filters; only the feed loads`, async ({ page, request }, info) => {
  const darkReducedMotion = change.name === "category" && info.project.name === "mobile";
  if (darkReducedMotion) await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const query = uniqueQuery();
  const gate = await arm(request, { q: query, ...change.signature });
  let saved: JSHandle<ShellNodes> | undefined;
  try {
    await page.goto(`/zh?q=${change.name === "query" ? "粉色" : query}&sort=latest`);
    await expect(cards(page)).toHaveCount(6);
    const input = page.getByRole("textbox", { name: homeInput, exact: true });
    await input.fill("切换分类时保留我的创作草稿");
    saved = await captureShell(page);
    const calls = (await status(request, gate)).provider_calls;
    await change.act(page, query);
    await expect.poll(async () => (await status(request, gate)).hits).toBeGreaterThan(0);
    await expect(page.getByTestId("gallery-skeleton")).toBeVisible();
    expect(await sameShell(page, saved)).toBe(true);
    const columns = await page.getByTestId("gallery-skeleton").locator(":scope > div:visible").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(info.project.name === "mobile" ? 2 : 5);
    await expect(input).toHaveValue("切换分类时保留我的创作草稿");
    await input.fill("阻塞期间仍可编辑的草稿");
    await expect(page.getByRole("combobox", { name: "排序方式", exact: true })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "模型", exact: true })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "搜索关键词", exact: true })).toBeEnabled();
    if (darkReducedMotion) await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: info.outputPath(`${change.name}-feed-only-pending.png`), fullPage: true });
    await release(request, gate);
    await expect(page.getByTestId("gallery-skeleton")).toBeHidden();
    await expect(cards(page)).toHaveCount(change.expectedCount);
    if (change.name === "category") await expect(cards(page).first()).toContainText("粉色产品摄影参考图 6");
    expect(new URL(page.url()).searchParams.get(change.parameter[0])).toBe(change.parameter[1] || query);
    await expect(input).toHaveValue("阻塞期间仍可编辑的草稿");
    expect(await sameShell(page, saved)).toBe(true);
    expect((await status(request, gate)).provider_calls).toBe(calls);
  } finally {
    await remove(request, gate);
    await saved?.dispose();
  }
});

test("an open conversation and its draft survive feed loading with compact skeleton columns", async ({ page, request }, info) => {
  const query = uniqueQuery();
  const gate = await arm(request, { q: query, sort: "popular" });
  let saved: JSHandle<ShellNodes> | undefined;
  try {
    await page.goto(`/zh?q=${query}&sort=latest`);
    await expect(cards(page)).toHaveCount(6);
    await page.getByRole("button", { name: "用《粉色产品摄影参考图 1》的图片创作提示词", exact: true }).filter({ visible: true }).click();
    const panel = page.getByRole("complementary", { name: panelLabel, exact: true });
    const input = panel.getByRole("textbox", { name: followupInput, exact: true });
    await expect(panel).toBeVisible();
    await input.fill("侧栏未发送的私密草稿");
    saved = await captureShell(page);
    const calls = (await status(request, gate)).provider_calls;
    await page.getByRole("combobox", { name: "排序方式", exact: true }).click();
    await page.getByRole("option", { name: "最受欢迎", exact: true }).click();
    await expect.poll(async () => (await status(request, gate)).hits).toBeGreaterThan(0);
    await expect(page.getByTestId("gallery-skeleton")).toBeVisible();
    expect(await sameShell(page, saved)).toBe(true);
    await expect(panel).toBeVisible();
    await expect(input).toHaveValue("侧栏未发送的私密草稿");
    await input.fill("筛选期间侧栏仍可继续编辑");
    const columns = await page.getByTestId("gallery-skeleton").locator(":scope > div:visible").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(info.project.name === "mobile" ? 2 : 3);
    await page.screenshot({ path: info.outputPath("open-chat-feed-only-pending.png"), fullPage: true });
    await release(request, gate);
    await expect(page.getByTestId("gallery-skeleton")).toBeHidden();
    await expect(cards(page)).toHaveCount(6);
    await expect(input).toHaveValue("筛选期间侧栏仍可继续编辑");
    expect(await sameShell(page, saved)).toBe(true);
    expect((await status(request, gate)).provider_calls).toBe(calls);
  } finally { await remove(request, gate); await saved?.dispose(); }
});

test("a late category A response never replaces the newer category B result", async ({ page, request }) => {
  const query = uniqueQuery();
  const first = await arm(request, { q: query, category: "portrait" });
  const second = await arm(request, { q: query, category: "avatar" });
  try {
    await page.goto(`/zh?q=${query}&sort=latest`);
    await expect(cards(page)).toHaveCount(6);
    await page.getByRole("textbox", { name: homeInput, exact: true }).fill("快速切换也保留草稿");
    const toolbar = page.locator("[data-gallery-toolbar]");
    await toolbar.getByRole("link", { name: "人像写真", exact: true }).click();
    await expect.poll(async () => (await status(request, first)).hits).toBeGreaterThan(0);
    await expect(page.getByTestId("gallery-skeleton")).toBeVisible();
    await toolbar.getByRole("link", { name: "头像", exact: true }).click();
    await expect.poll(async () => (await status(request, second)).hits).toBeGreaterThan(0);
    const calls = (await status(request, first)).provider_calls;
    await release(request, second);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("粉色产品摄影参考图 5");
    expect(new URL(page.url()).searchParams.get("category")).toBe("avatar");
    await release(request, first);
    await expect.poll(async () => (await status(request, first)).finished).toBeGreaterThan(0);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("粉色产品摄影参考图 5");
    await expect(toolbar.getByRole("link", { name: "头像", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("textbox", { name: homeInput, exact: true })).toHaveValue("快速切换也保留草稿");
    expect((await status(request, first)).provider_calls).toBe(calls);
  } finally { await remove(request, first); await remove(request, second); }
});

test("initial home and direct category requests still contain server-rendered prompt cards", async ({ request }) => {
  for (const path of ["/zh", "/zh/category/portrait"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<article\b[^>]*data-prompt-id=/);
    expect(html).toContain("粉色产品摄影参考图");
    if (path.includes("category")) expect(html).toContain("粉色产品摄影参考图 6");
  }
});
