import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrollLock } from "./use-scroll-lock";

function Overlay() {
  useScrollLock();
  return null;
}

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.scrollLocked;
});

describe("overlay scroll lock", () => {
  it("locks the page while mounted and restores it when closed", () => {
    const overlay = render(<Overlay />);
    expect(document.documentElement.dataset.scrollLocked).toBe("true");
    overlay.unmount();
    expect(document.documentElement.dataset.scrollLocked).toBeUndefined();
  });

  it("keeps the page locked until every overlapping overlay closes", () => {
    const first = render(<Overlay />);
    const second = render(<Overlay />);
    first.unmount();
    expect(document.documentElement.dataset.scrollLocked).toBe("true");
    second.unmount();
    expect(document.documentElement.dataset.scrollLocked).toBeUndefined();
  });

  it("preserves an existing lock and survives Strict Mode cleanup", () => {
    document.documentElement.dataset.scrollLocked = "existing";
    const overlay = render(<StrictMode><Overlay /></StrictMode>);
    expect(document.documentElement.dataset.scrollLocked).toBe("true");
    overlay.unmount();
    expect(document.documentElement.dataset.scrollLocked).toBe("existing");
  });
});
