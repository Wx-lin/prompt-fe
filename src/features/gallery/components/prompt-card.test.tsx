import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { GalleryCard } from "@/types/prompt";
import { PromptCard } from "./prompt-card";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} />, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: ({ fill, unoptimized, ...props }: ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => {
  void fill; void unoptimized;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt} />;
} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const prompt: GalleryCard = { id: "one", title: "作品", category: "art", models: [], thumbnail_url: null, image: "https://example.com/one.jpg", imageWidth: 400, imageHeight: 600, promptText: "示例提示词", like_count: 0, view_count: 0, author_name: null, created_at: "" };

describe("gallery card actions", () => {
  it("shows only view and create-similar actions and passes the selected card to creation", () => {
    const create = vi.fn();
    render(<PromptCard prompt={prompt} onUseReference={create} />);
    const actions = within(screen.getByRole("group", { name: "actions" }));
    expect(actions.getByTestId("prompt-view-link")).toHaveAttribute("href", "/prompt/one");
    expect(actions.queryByRole("button", { name: "copy" })).not.toBeInTheDocument();
    expect(actions.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(actions.getByRole("button", { name: "createFromImageAriaLabel" }));
    expect(create).toHaveBeenCalledWith(prompt);
  });

  it("offers only the view action when no reference image is available", () => {
    render(<PromptCard prompt={{ ...prompt, image: "" }} onUseReference={vi.fn()} />);
    const actions = within(screen.getByRole("group", { name: "actions" }));
    expect(actions.getByTestId("prompt-view-link")).toHaveAttribute("href", "/prompt/one");
    expect(actions.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps copying on cards outside the creation-enabled gallery", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
    render(<PromptCard prompt={prompt} />);
    fireEvent.click(within(screen.getByRole("group", { name: "actions" })).getByRole("button", { name: "copy" }));
    expect(copy).toHaveBeenCalledWith("示例提示词");
    expect(await screen.findByRole("button", { name: "copied" })).toBeInTheDocument();
  });

  it("labels the creation action clearly in Chinese and English", () => {
    expect(zh.card.createFromImageShort).toBe("做同款");
    expect(en.card.createFromImageShort).toBe("Create similar");
  });
});
