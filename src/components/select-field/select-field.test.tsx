import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SelectField } from "./select-field";
const push = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ value: "q=cat&category=portrait" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(params.value) }));
beforeEach(() => {
  params.value = "q=cat&category=portrait";
  class TestPointerEvent extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? "mouse"; }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); push.mockClear(); });
it("groups specific versions by family and navigates with the selected version", async () => {
  const user = userEvent.setup();
  render(<SelectField label="Models" name="models" defaultValue="all" options={[
    { label: "All models", value: "all" },
    { label: "Midjourney V6", value: "Midjourney V6", group: "Midjourney" },
    { label: "Midjourney V7", value: "Midjourney V7", group: "Midjourney" },
    { label: "FLUX.1", value: "FLUX.1", group: "FLUX" },
  ]} />);
  await user.click(screen.getByRole("combobox", { name: "Models" }));
  const group = await screen.findByRole("group", { name: "Midjourney" });
  expect(within(group).getAllByRole("option")).toHaveLength(2);
  expect(screen.getByRole("group", { name: "FLUX" })).toBeVisible();
  await user.click(within(group).getByRole("option", { name: "Midjourney V7" }));
  expect(push).toHaveBeenCalledWith("/?q=cat&category=portrait&models=Midjourney+V7");
});
it("keeps ungrouped options flat", async () => {
  const user = userEvent.setup();
  render(<SelectField label="Sort" name="sort" defaultValue="latest" options={[{ label: "Latest", value: "latest" }, { label: "Popular", value: "popular" }]} />);
  await user.click(screen.getByRole("combobox", { name: "Sort" }));
  expect(await screen.findAllByRole("option")).toHaveLength(2);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
});

it("hides a redundant singleton family title while preserving the selectable value", async () => {
  const user = userEvent.setup();
  render(<SelectField label="Models" name="models" defaultValue="all" options={[
    { label: "All models", value: "all" },
    { label: "FLUX", value: "FLUX", group: "FLUX" },
    { label: "Midjourney", value: "Midjourney", group: "Midjourney" },
    { label: "Midjourney V7", value: "Midjourney V7", group: "Midjourney" },
  ]} />);
  await user.click(screen.getByRole("combobox", { name: "Models" }));
  expect(await screen.findByRole("option", { name: "FLUX" })).toBeVisible();
  expect(screen.getAllByText("FLUX")).toHaveLength(1);
  expect(screen.queryByRole("group", { name: "FLUX" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: "Midjourney" })).getAllByRole("option")).toHaveLength(2);
  await user.click(screen.getByRole("option", { name: "FLUX" }));
  expect(push).toHaveBeenCalledWith("/?q=cat&category=portrait&models=FLUX");
});
it("keeps latest explicit because the homepage default is recommended", async () => {
  const user = userEvent.setup();
  render(<SelectField label="Sort" name="sort" defaultValue="recommended" options={[{ label: "Recommended", value: "recommended" }, { label: "Latest", value: "latest" }]} />);
  await user.click(screen.getByRole("combobox", { name: "Sort" }));
  await user.click(await screen.findByRole("option", { name: "Latest" }));
  expect(push).toHaveBeenCalledWith("/?q=cat&category=portrait&sort=latest");
});

it.each([["category=portrait&models=FLUX&sort=latest", "/?category=portrait&models=FLUX"], ["q=cat&category=portrait&sort=latest", "/?q=cat&category=portrait&sort=recommended"]])("selects recommended with contextual URL defaults (%s)", async (query, expected) => {
  params.value = query;
  render(<SelectField label="Sort" name="sort" defaultValue="latest" options={[{ label: "Recommended", value: "recommended" }, { label: "Latest", value: "latest" }]} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Sort" }));
  await user.click(await screen.findByRole("option", { name: "Recommended" }));
  expect(push).toHaveBeenCalledWith(expected);
});
