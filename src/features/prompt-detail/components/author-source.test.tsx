import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthorSource } from "./author-source";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);

describe("AuthorSource", () => {
  it.each([
    ["https://xiaohongshu.com/explore/1", "xiaohongshu"],
    ["https://weibo.com/1/2", "weibo"],
    ["https://kuaishou.com/short-video/1", "kuaishou"],
  ])("links the author and work to %s", (url, platform) => {
    render(<AuthorSource authorName="包***水" authorAvatarUrl="https://example.com/avatar.jpg" sourceUrl={url} />);
    expect(screen.getByText("包***水")).toBeInTheDocument();
    expect(screen.queryByText("workSource")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: platform })).toBeInTheDocument();
    expect(screen.queryByText(platform)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "包***水" })).toHaveAttribute("src", "https://example.com/avatar.jpg");
    expect(screen.queryByText("包")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "viewOriginal" })).toHaveAttribute("href", url);
    expect(screen.getByRole("link", { name: `包***水 · ${platform} · viewOriginal` })).toHaveAttribute("href", url);
  });

  it("shows a neutral fallback without outbound links for unsupported sources", () => {
    render(<AuthorSource authorName={null} sourceUrl="javascript:alert(1)" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByText("aiCreator")).toHaveLength(2);
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.getByTestId("default-author-avatar")).toHaveAttribute("src", expect.stringMatching(/^\/default-avatars\/(male|female)\.png$/));
  });

  it("uses the designed fallback when a source avatar is missing or fails to load", () => {
    const { rerender } = render(<AuthorSource authorName="作者" sourceUrl="https://weibo.com/1/2" />);
    const fallbackSrc = screen.getByTestId("default-author-avatar").getAttribute("src");
    expect(fallbackSrc).toMatch(/^\/default-avatars\/(male|female)\.png$/);
    rerender(<AuthorSource authorName="作者" authorAvatarUrl="https://example.com/avatar.jpg" sourceUrl="https://weibo.com/1/2" />);
    fireEvent.error(screen.getByRole("img", { name: "作者" }));
    expect(screen.getByTestId("default-author-avatar")).toHaveAttribute("src", fallbackSrc);
    expect(screen.queryByRole("img", { name: "作者" })).not.toBeInTheDocument();
  });

  it("assigns a stable default portrait for the same author", () => {
    const { rerender } = render(<AuthorSource authorName="作者甲" sourceUrl="https://weibo.com/1/2" />);
    const firstSrc = screen.getByTestId("default-author-avatar").getAttribute("src");
    rerender(<AuthorSource authorName="作者甲" sourceUrl="https://weibo.com/1/3" />);
    expect(screen.getByTestId("default-author-avatar")).toHaveAttribute("src", firstSrc);
  });
});
