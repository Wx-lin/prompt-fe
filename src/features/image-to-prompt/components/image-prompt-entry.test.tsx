import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dialog } from "@base-ui/react/dialog";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ANNOUNCEMENT_END, ANNOUNCEMENT_STORAGE_KEY } from "../lib/announcement";

let ImagePromptEntry: typeof import("./image-prompt-entry").ImagePromptEntry;
const copy = { entry: "图片转提示词", announcementDismiss: "关闭新功能提示", announcementTitle: "图片，也能变成提示词", announcementDescription: "上传参考图，提取画面、风格与构图。", announcementEyebrow: "新功能上线", announcementAction: "上传图片" };
beforeEach(async () => {
  vi.resetModules();
  ({ ImagePromptEntry } = await import("./image-prompt-entry"));
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-10-23T12:00:00+08:00").getTime());
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function fixture(allowed: boolean, onOpen: () => void) {
  return <NextIntlClientProvider locale="zh" messages={{ imageToPrompt: copy }}><Dialog.Root><ImagePromptEntry announcementAllowed={allowed} onOpen={onOpen} /><Dialog.Portal><Dialog.Popup><Dialog.Title>解析工作台</Dialog.Title><Dialog.Description>工作台内容</Dialog.Description></Dialog.Popup></Dialog.Portal></Dialog.Root></NextIntlClientProvider>;
}
function setup(allowed = true, onOpen = vi.fn()) {
  return { onOpen, ...render(fixture(allowed, onOpen)) };
}

it("uses one precisely named dialog trigger with a decorative image-to-text icon", async () => {
  setup();
  const trigger = screen.getByRole("button", { name: copy.entry });
  expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("NEW")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getAllByRole("button", { name: copy.entry })).toHaveLength(1);
  expect(await screen.findByRole("heading", { name: copy.announcementTitle })).toBeVisible();
});
it("does not take focus when the automatic announcement opens", async () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  setup();
  await screen.findByText(copy.announcementTitle);
  expect(outside).toHaveFocus();
  outside.remove();
});
it("dismisses using its close button and persists only the dismissal flag", async () => {
  setup();
  fireEvent.click(await screen.findByRole("button", { name: copy.announcementDismiss }));
  await waitFor(() => expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument());
  expect(localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY)).toBe("1");
  expect(localStorage.length).toBe(1);
  expect(screen.getByText("NEW")).toBeVisible();
});
it("dismisses using Escape without moving keyboard focus", async () => {
  setup();
  const trigger = screen.getByRole("button", { name: copy.entry });
  trigger.focus();
  await screen.findByText(copy.announcementTitle);
  fireEvent.keyDown(trigger, { key: "Escape" });
  await waitFor(() => expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});
it("dismisses from an outside pointer press", async () => {
  setup();
  await screen.findByText(copy.announcementTitle);
  fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
  fireEvent.mouseDown(document.body, { button: 0 });
  fireEvent.click(document.body);
  await waitFor(() => expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument());
});
it("opens the real workspace exactly once from the announcement action", async () => {
  const { onOpen } = setup();
  fireEvent.click(await screen.findByRole("button", { name: copy.announcementAction }));
  expect(await screen.findByRole("heading", { name: "解析工作台" })).toBeVisible();
  expect(onOpen).toHaveBeenCalledOnce();
  expect(localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY)).toBe("1");
});
it("opens the same workspace directly from the entry", () => {
  const { onOpen } = setup(false);
  fireEvent.click(screen.getByRole("button", { name: copy.entry }));
  expect(screen.getByRole("heading", { name: "解析工作台" })).toBeVisible();
  expect(onOpen).toHaveBeenCalledOnce();
});
it("suppresses the prompt while another tool is open without losing the entry", () => {
  setup(false);
  expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: copy.entry })).toBeVisible();
});
it("remembers dismissal when another feature takes over and does not reopen afterwards", async () => {
  const { onOpen, rerender } = setup();
  await screen.findByText(copy.announcementTitle);
  rerender(fixture(false, onOpen));
  expect(localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY)).toBe("1");
  rerender(fixture(true, onOpen));
  await waitFor(() => expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument());
});
it("removes the NEW badge after the campaign ends", () => {
  vi.mocked(Date.now).mockReturnValue(ANNOUNCEMENT_END);
  setup();
  expect(screen.queryByText("NEW")).not.toBeInTheDocument();
  expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument();
});
it("responds to dismissal from a different browser tab", async () => {
  setup();
  await screen.findByText(copy.announcementTitle);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: ANNOUNCEMENT_STORAGE_KEY, newValue: "1" })));
  await waitFor(() => expect(screen.queryByText(copy.announcementTitle)).not.toBeInTheDocument());
});
