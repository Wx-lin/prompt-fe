import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { promptConversationClient } from "../lib/client";
import { CreationProvider } from "./creation-provider";
import { CreationGallery } from "./creation-gallery";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), Link: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/features/auth/components/login-page", () => ({ LoginPage: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="登录"><button onClick={onClose}>关闭登录</button></div> }));
vi.mock("@/features/gallery/components/gallery-page", () => ({ GalleryPage: ({ creationComposer, chatPanel, items, onUseReference }: { creationComposer: React.ReactNode; chatPanel: React.ReactNode; items: unknown[]; onUseReference: (item: unknown) => void }) => <main>{creationComposer}{chatPanel}{items.map((item, index) => <button key={index} onClick={() => onUseReference(item)}>做同款</button>)}</main> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const props = { items: [], categories: [], activeCategory: "all", activeSort: "recommended", activeModel: "all", models: [], user: { id: "account-a" } } as unknown as ComponentProps<typeof CreationGallery>;
const firstArtwork = "00000000-0000-4000-8000-000000000001";
const secondArtwork = "00000000-0000-4000-8000-000000000002";
function view(extra = {}) { return <NextIntlClientProvider locale="zh" messages={messages}><CreationProvider><CreationGallery {...props} {...extra} /></CreationProvider></NextIntlClientProvider>; }

it("shows one inline creation entry; sending opens the same-page conversation without a dialog", async () => {
  vi.spyOn(promptConversationClient, "create").mockRejectedValue(new Error("offline"));
  render(view());
  const textbox = screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" });
  fireEvent.change(textbox, { target: { value: "雨夜的小猫" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(promptConversationClient.create).toHaveBeenCalledOnce());
  expect(screen.getByRole("complementary", { name: "提示词创作对话" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("雨夜的小猫");
  fireEvent.click(screen.getByRole("button", { name: "收起" }));
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("雨夜的小猫");
});

it("keeps anonymous input when opening existing login, and cancelling never generates", async () => {
  const create = vi.spyOn(promptConversationClient, "create");
  render(view({ user: null }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "我的想法" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  expect(screen.getByRole("dialog", { name: "登录" })).toBeVisible();
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "关闭登录" }));
  expect(screen.getByRole("textbox")).toHaveValue("我的想法");
});

it("places a gallery artwork and its prompt in the homepage composer without opening chat or sending", async () => {
  const create = vi.spyOn(promptConversationClient, "create");
  const importReference = vi.spyOn(promptConversationClient, "importReference");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(view({ items: [{ id: firstArtwork, title: "雨夜街头", image: "/example-artwork.jpg", promptText: "雨夜街头，霓虹灯和电影感光影" }] }));

  fireEvent.click(screen.getByRole("button", { name: "做同款" }));

  await waitFor(() => expect(screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" })).toHaveValue("雨夜街头，霓虹灯和电影感光影"));
  expect(screen.getByRole("img", { name: "参考图片" })).toHaveAttribute("src", "/example-artwork.jpg");
  expect(screen.queryByRole("complementary", { name: "提示词创作对话" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(importReference).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("loads the public prompt detail when the gallery feed has no prompt text", async () => {
  const create = vi.spyOn(promptConversationClient, "create");
  const importReference = vi.spyOn(promptConversationClient, "importReference");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: firstArtwork, prompt_text: "完整的画面提示词", title: "山水" }));
  vi.stubGlobal("fetch", fetchMock);
  render(view({ items: [{ id: firstArtwork, title: "山水", image: "/mountain.jpg" }] }));

  fireEvent.click(screen.getByRole("button", { name: "做同款" }));

  await waitFor(() => expect(screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" })).toHaveValue("完整的画面提示词"));
  expect(screen.getByRole("img", { name: "参考图片" })).toHaveAttribute("src", "/mountain.jpg");
  expect(screen.queryByRole("complementary", { name: "提示词创作对话" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(importReference).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

it("does not overwrite the latest selected artwork with an earlier detail response", async () => {
  const resolves: Array<(response: Response) => void> = [];
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { resolves.push(resolve); })));
  render(view({ items: [
    { id: firstArtwork, title: "甲", image: "/a.jpg" },
    { id: secondArtwork, title: "乙", image: "/b.jpg" },
  ] }));

  const buttons = screen.getAllByRole("button", { name: "做同款" });
  fireEvent.click(buttons[0]);
  await waitFor(() => expect(resolves).toHaveLength(1));
  fireEvent.click(buttons[1]);
  await waitFor(() => expect(resolves).toHaveLength(2));
  await act(async () => resolves[1](Response.json({ id: secondArtwork, prompt_text: "作品乙提示词" })));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" })).toHaveValue("作品乙提示词"));
  await act(async () => resolves[0](Response.json({ id: firstArtwork, prompt_text: "作品甲提示词" })));

  expect(screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" })).toHaveValue("作品乙提示词");
  expect(screen.getByRole("img", { name: "参考图片" })).toHaveAttribute("src", "/b.jpg");
  expect(screen.queryByRole("complementary", { name: "提示词创作对话" })).not.toBeInTheDocument();
});

it("keeps both the artwork prompt and the user's text typed while details load", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
  render(view({ items: [{ id: firstArtwork, title: "甲", image: "/a.jpg" }] }));

  fireEvent.click(screen.getByRole("button", { name: "做同款" }));
  await waitFor(() => expect(resolve).toBeDefined());
  const textbox = screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" });
  fireEvent.change(textbox, { target: { value: "用户已经修改的内容" } });
  await act(async () => resolve(Response.json({ id: firstArtwork, prompt_text: "作品甲提示词" })));

  const value = (textbox as HTMLTextAreaElement).value;
  expect(value).toContain("用户已经修改的内容");
  expect(value).toContain("作品甲提示词");
  expect(value).toContain("\n");
  expect(screen.getByRole("img", { name: "参考图片" })).toHaveAttribute("src", "/a.jpg");
});

it("informs the user if the original artwork prompt cannot be loaded", async () => {
  const create = vi.spyOn(promptConversationClient, "create");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  render(view({ items: [{ id: firstArtwork, title: "甲", image: "/a.jpg" }] }));

  fireEvent.click(screen.getByRole("button", { name: "做同款" }));

  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("complementary", { name: "提示词创作对话" })).not.toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

it("retains a long source prompt without silently truncating and allows the user to shorten it before sending", async () => {
  const create = vi.spyOn(promptConversationClient, "create");
  const promptText = "字".repeat(1201);
  render(view({ items: [{ id: firstArtwork, title: "长提示词", image: "/long.jpg", promptText }] }));

  fireEvent.click(screen.getByRole("button", { name: "做同款" }));

  const textbox = screen.getByRole("textbox", { name: "描述想生成的画面，或直接聊天" });
  expect(textbox).toHaveValue(promptText);
  expect(screen.getByRole("alert")).toHaveTextContent("提示词超过 500 字");
  expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  expect(create).not.toHaveBeenCalled();
  fireEvent.change(textbox, { target: { value: "字".repeat(500) } });
  expect(textbox).toHaveValue("字".repeat(500));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();
  expect(create).not.toHaveBeenCalled();
});
