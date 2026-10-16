import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { DetailPage } from "./detail-page";
import type { GalleryCard } from "@/types/prompt";

vi.mock("next-intl", () => ({ useTranslations: () => Object.assign((key: string) => key, { has: () => true }) }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} />, useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/scroll/use-scroll-lock", () => ({ useScrollLock: () => {} }));
const prompt: GalleryCard = { id: "test", title: "作品", category: "portrait", models: [], thumbnail_url: null, like_count: 0, view_count: 0, author_name: null, created_at: "2026-10-16", image: "", imageWidth: 1, imageHeight: 1 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("copies the current URL even when native sharing is supported", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  window.history.replaceState({}, "", "/prompt/test?q=cat&models=FLUX#image-2");
  render(<DetailPage prompt={prompt} />);
  fireEvent.click(screen.getByRole("button", { name: "share" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
  expect(share).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: "shared" })).toBeInTheDocument();
});
