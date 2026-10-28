import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GalleryLoading, GallerySkeleton } from "./gallery-skeleton";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);

it("provides a complete first-load shell without actionable placeholder controls", () => {
  render(<GalleryLoading />);
  expect(screen.getByRole("main")).toContainElement(screen.getByRole("status"));
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("shows responsive placeholders with one accessible loading status and no empty state or links", () => {
  render(<GallerySkeleton />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveAccessibleName("loading");
  const cards = screen.getAllByTestId("gallery-skeleton-card");
  expect(cards).toHaveLength(20);
  for (const card of cards) expect(card).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByText("emptyDefault")).not.toBeInTheDocument();
});

it("limits the local loading layout to three desktop columns beside an open chat", () => {
  const { container } = render(<GallerySkeleton compact />);
  expect(container.querySelector('[data-layout="desktop"]')?.children).toHaveLength(3);
  expect(container.querySelector('[data-layout="mobile"]')?.children).toHaveLength(2);
  expect(screen.getAllByTestId("gallery-skeleton-card")).toHaveLength(20);
  expect(screen.queryByRole("banner")).not.toBeInTheDocument();
});
