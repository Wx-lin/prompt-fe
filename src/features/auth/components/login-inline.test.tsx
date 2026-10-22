import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import messages from "../../../../messages/zh.json";
import { LoginPage } from "./login-page";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} />, useRouter: () => navigation }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("returnTo=/publish") }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function login(onAuthenticated?: () => void) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json({ ok: true })));
  render(<NextIntlClientProvider locale="zh" messages={messages}><LoginPage onAuthenticated={onAuthenticated} /></NextIntlClientProvider>);
  fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "sample@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByLabelText("邮箱验证码");
  fireEvent.change(screen.getByLabelText("邮箱验证码"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "验证并登录" }));
}
it("completes inline login without leaving the selected image workflow", async () => {
  const authenticated = vi.fn();
  await login(authenticated);
  await waitFor(() => expect(authenticated).toHaveBeenCalledOnce());
  expect(navigation.push).not.toHaveBeenCalled();
});
it("keeps original route-based redirect when no callback is supplied", async () => {
  await login();
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/publish"));
  expect(navigation.refresh).toHaveBeenCalledOnce();
});
it("closes inline login with its caller callback", () => {
  const close = vi.fn();
  render(<NextIntlClientProvider locale="zh" messages={messages}><LoginPage onClose={close} /></NextIntlClientProvider>);
  fireEvent.click(screen.getByRole("link", { name: "关闭登录" }));
  expect(close).toHaveBeenCalledOnce();
  expect(navigation.back).not.toHaveBeenCalled();
});
