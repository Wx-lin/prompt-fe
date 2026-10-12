import type { ComponentProps } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => <a {...props} />,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const currentUser = {
  id: "user-1", email: "creator@example.com", nickname: "Creator",
  avatar_url: null, created_at: "2026-10-12T00:00:00Z",
};

beforeEach(() => {
  // jsdom does not expose PointerEvent; Base UI distinguishes mouse clicks using pointerType.
  class TestPointerEvent extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("UserMenu", () => {
  it("shows a visible dropdown indicator alongside the avatar", () => {
    render(<UserMenu user={currentUser} />);
    const trigger = screen.getByRole("button", { name: "userMenuAriaLabel" });
    const indicator = trigger.querySelector("svg");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toBeVisible();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("opens account actions and closes with Escape while restoring trigger focus", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={currentUser} />);
    const trigger = screen.getByRole("button", { name: "userMenuAriaLabel" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40, toJSON: () => ({}),
    });
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("menuitem", { name: "myCollections" })).toHaveAttribute("href", "/collections");
    expect(screen.getByRole("menuitem", { name: "logout" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
