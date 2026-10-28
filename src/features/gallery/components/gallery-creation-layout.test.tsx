import { Suspense, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { GalleryCard } from "@/types/prompt";
import { GalleryPage } from "./gallery-page";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./site-header", () => ({ SiteHeader: ({ showNavigationRow }: { showNavigationRow: boolean }) => <header data-contains-toolbar={showNavigationRow} /> }));
vi.mock("./gallery-toolbar", () => ({ GalleryToolbar: ({ query }: { query: string }) => <div data-testid="gallery-toolbar" data-query={query} /> }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("./gallery-grid", () => ({ GalleryGrid: function Feed({ compact, onUseReference, activeReferenceId }: { compact: boolean; onUseReference: (prompt: GalleryCard) => void; activeReferenceId?: string }) {
  const [count, setCount] = useState(0);
  return <div data-testid="feed" data-compact={compact} data-reference={activeReferenceId}><button onClick={() => setCount(count + 1)}>local state {count}</button><button onClick={() => onUseReference({ id: "reference" } as GalleryCard)}>use reference</button></div>;
} }));
afterEach(cleanup);
const props = { items: [] as GalleryCard[], categories: [], models: [], activeCategory: "all", activeSort: "recommended", activeModel: "all", query: "cat" };

it("keeps the gallery and drafts mounted while switching between home composer and inline chat", () => {
  const slots = { creationComposer: <textarea aria-label="idea" defaultValue="my idea" />, chatPanel: <textarea aria-label="followup" defaultValue="my adjustment" /> };
  const view = render(<GalleryPage {...props} {...slots} />);
  const feed = screen.getByTestId("feed");
  const idea = screen.getByRole("textbox", { name: "idea" });
  fireEvent.click(screen.getByRole("button", { name: "local state 0" }));
  expect(idea).toBeVisible();
  expect(screen.getByTestId("creation-chat-pane")).not.toBeVisible();
  view.rerender(<GalleryPage {...props} {...slots} chatOpen />);
  expect(screen.getByTestId("feed")).toBe(feed);
  expect(feed).toHaveAttribute("data-compact", "true");
  expect(screen.getByRole("button", { name: "local state 1" })).toBeVisible();
  expect(idea).not.toBeVisible();
  const followup = screen.getByRole("textbox", { name: "followup" });
  fireEvent.change(followup, { target: { value: "still private" } });
  view.rerender(<GalleryPage {...props} {...slots} />);
  expect(feed).toHaveAttribute("data-compact", "false");
  expect(idea).toHaveValue("my idea");
  expect(idea).toBeVisible();
  expect(followup).toHaveValue("still private");
  expect(followup).not.toBeVisible();
  expect(screen.getByTestId("gallery-toolbar")).toHaveAttribute("data-query", "cat");
});

it("passes reference selection through without changing the gallery route", () => {
  const select = vi.fn();
  render(<GalleryPage {...props} onUseReference={select} activeReferenceId="reference" />);
  fireEvent.click(screen.getByRole("button", { name: "use reference" }));
  expect(select).toHaveBeenCalledExactlyOnceWith({ id: "reference" });
  expect(screen.getByTestId("feed")).toHaveAttribute("data-reference", "reference");
  expect(screen.getByRole("banner")).toHaveAttribute("data-contains-toolbar", "false");
});

it("keeps an inert public sidebar shell for exit layout without retaining removed private content", () => {
  const view = render(<GalleryPage {...props} chatOpen chatPanel={<p>account A private content</p>} />);
  view.rerender(<GalleryPage {...props} chatPanel={null} />);
  expect(screen.queryByText("account A private content")).not.toBeInTheDocument();
  expect(screen.getByTestId("creation-chat-pane")).toHaveAttribute("inert");
  expect(screen.getByTestId("creation-chat-pane")).toHaveAttribute("aria-hidden", "true");
});

it("keeps the header, composer and toolbar mounted while only a feed slot is loading", () => {
  const pending = new Promise<never>(() => {});
  function PendingFeed(): never { throw pending; }
  const loading = (key: string) => <Suspense key={key} fallback={<p>loading feed only</p>}><PendingFeed /></Suspense>;
  const composer = <textarea aria-label="stable idea" defaultValue="preserved draft" />;
  const view = render(<GalleryPage {...props} creationComposer={composer} feedContent={loading("portrait")} />);
  const input = screen.getByRole("textbox", { name: "stable idea" });
  const toolbar = screen.getByTestId("gallery-toolbar");
  const header = screen.getByRole("banner");
  expect(screen.getByText("loading feed only")).toBeVisible();
  expect(screen.queryByTestId("feed")).not.toBeInTheDocument();
  view.rerender(<GalleryPage {...props} activeCategory="avatar" creationComposer={composer} feedContent={loading("avatar")} />);
  expect(screen.getByRole("textbox", { name: "stable idea" })).toBe(input);
  expect(input).toHaveValue("preserved draft");
  expect(screen.getByTestId("gallery-toolbar")).toBe(toolbar);
  expect(screen.getByRole("banner")).toBe(header);
});
