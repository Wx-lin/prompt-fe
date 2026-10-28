import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { promptConversationClient } from "../lib/client";
import { CreationProvider } from "./creation-provider";
import { CreationGallery } from "./creation-gallery";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), Link: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/features/auth/components/login-page", () => ({ LoginPage: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="登录"><button onClick={onClose}>关闭登录</button></div> }));
vi.mock("@/features/gallery/components/gallery-page", () => ({ GalleryPage: ({ creationComposer, chatPanel }: { creationComposer: React.ReactNode; chatPanel: React.ReactNode }) => <main>{creationComposer}{chatPanel}</main> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const props = { items: [], categories: [], activeCategory: "all", activeSort: "recommended", activeModel: "all", models: [], user: { id: "account-a" } } as unknown as ComponentProps<typeof CreationGallery>;
function view(extra = {}) { return <NextIntlClientProvider locale="zh" messages={messages}><CreationProvider><CreationGallery {...props} {...extra} /></CreationProvider></NextIntlClientProvider>; }

it("shows one inline creation entry; sending opens the same-page conversation without a dialog", async () => {
  vi.spyOn(promptConversationClient, "create").mockRejectedValue(new Error("offline"));
  render(view());
  const textbox = screen.getByRole("textbox", { name: "说说你的想法，帮你写成提示词" });
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
