import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { GalleryCard } from "@/types/prompt";
import { GalleryGrid } from "./gallery-grid";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => <a {...props} />,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/image", () => ({
  default: ({ fill, unoptimized, ...props }: ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => {
    void fill;
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));
afterEach(cleanup);

function card(id: string, width = 300, height = 400): GalleryCard {
  return { id, title: id, category: "art", models: [], thumbnail_url: null,
    image: `https://example.com/${id}.jpg`, imageWidth: width, imageHeight: height,
    like_count: 0, view_count: 0, author_name: null, created_at: "" };
}

describe("gallery long-image filtering", () => {
  it("filters known images over 3:1 while retaining the boundary and normal images", () => {
    render(<GalleryGrid items={[card("long", 300, 901), card("boundary", 300, 900), card("normal")]} />);
    expect(screen.queryAllByAltText("long")).toHaveLength(0);
    expect(screen.getAllByAltText("boundary")).toHaveLength(2);
    expect(screen.getAllByAltText("normal")).toHaveLength(2);
  });

  it("removes a newly detected long image from both layouts and redistributes remaining cards", () => {
    render(<GalleryGrid items={[card("long"), card("normal")]} />);
    const image = screen.getAllByAltText("long")[0];
    Object.defineProperties(image, { naturalWidth: { value: 300 }, naturalHeight: { value: 1500 } });
    fireEvent.load(image);
    expect(screen.queryAllByAltText("long")).toHaveLength(0);
    expect(screen.getByTestId("gallery-grid").firstElementChild?.querySelector("img")?.alt).toBe("normal");
  });

  it("keeps the pagination sentinel when every item is filtered", () => {
    const sentinel = vi.fn();
    render(<GalleryGrid items={[card("long", 300, 1200)]} sentinelRef={sentinel} />);
    expect(screen.queryAllByAltText("long")).toHaveLength(0);
    expect(screen.getByText("emptyDefault")).toBeInTheDocument();
    expect(sentinel).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it("retains images with unavailable dimensions", () => {
    render(<GalleryGrid items={[card("unknown", 0, 0)]} />);
    fireEvent.load(screen.getAllByAltText("unknown")[0]);
    expect(screen.getAllByAltText("unknown")).toHaveLength(2);
  });

  it("keeps the same sentinel after runtime filtering and accepts the next page", () => {
    const sentinel = { current: null as HTMLDivElement | null };
    const { rerender } = render(<GalleryGrid items={[card("long")]} sentinelRef={sentinel} />);
    const originalSentinel = sentinel.current;
    const image = screen.getAllByAltText("long")[0];
    Object.defineProperties(image, { naturalWidth: { value: 300 }, naturalHeight: { value: 1500 } });
    fireEvent.load(image);
    expect(screen.queryAllByAltText("long")).toHaveLength(0);
    expect(sentinel.current).toBe(originalSentinel);
    rerender(<GalleryGrid items={[card("long"), card("next-page")]} sentinelRef={sentinel} />);
    expect(screen.queryAllByAltText("long")).toHaveLength(0);
    expect(screen.getAllByAltText("next-page")).toHaveLength(2);
  });

  it("keeps a loaded 3:1 image at its natural ratio", () => {
    render(<GalleryGrid items={[card("boundary")]} />);
    const image = screen.getAllByAltText("boundary")[0];
    Object.defineProperties(image, { naturalWidth: { value: 300 }, naturalHeight: { value: 900 } });
    fireEvent.load(image);
    expect(screen.getAllByAltText("boundary")).toHaveLength(2);
    expect(image.closest("article")?.firstElementChild).toHaveStyle({ aspectRatio: String(1 / 3) });
  });
});
