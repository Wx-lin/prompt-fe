import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterLibrary } from "./character-library";
import { characterDraftKey, consumeCharacterFreshStart } from "@/features/character-builder/character-draft-scope";

vi.mock("@/i18n/navigation", () => ({ Link: (props: React.ComponentProps<"a">) => <a {...props} /> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("角色库", () => {
  it("筛选使用项目选择组件，可用键盘选择并更新角色列表", async () => {
    const user = userEvent.setup();
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    const select = screen.getByRole("combobox", { name: "性别" });
    expect(select.tagName).toBe("BUTTON");
    select.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("option", { name: "男性" })).toBeVisible();
    await user.keyboard("{End}{Enter}");
    expect(screen.getByText("阳光青年")).toBeVisible();
    expect(screen.queryByText("都市女生")).not.toBeInTheDocument();
  });
  it("浏览、筛选官方角色并进入编辑或创建", () => {
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    expect(screen.getByRole("link", { name: /编辑都市女生/ })).toHaveAttribute("href", "/character-setting?preset=urban-woman");
    expect(screen.getByRole("link", { name: /创建角色/ })).toHaveAttribute("href", "/character-setting?new=1");
    fireEvent.change(screen.getByLabelText("搜索角色"), { target: { value: "古风" } });
    expect(screen.getByText("古风侠客")).toBeVisible();
    expect(screen.queryByText("都市女生")).not.toBeInTheDocument();
  });

  it("仅显式新建时标记为重新开始，打开已有角色保留草稿", () => {
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    const officialLink = screen.getByRole("link", { name: /编辑都市女生/ });
    officialLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(officialLink);
    expect(consumeCharacterFreshStart(characterDraftKey("?preset=urban-woman"))).toBe(false);
    const createLink = screen.getByRole("link", { name: /创建角色/ });
    createLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(createLink);
    expect(consumeCharacterFreshStart(characterDraftKey("?new=1"))).toBe(true);
  });

  it("未登录访问个人角色库时提供登录入口", () => {
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "我的角色库" }));
    expect(screen.getByText("登录后查看你的角色")).toBeVisible();
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login?returnTo=%2Fcharacter-library%3Ftab%3Dmine");
  });

  it("支持按年龄段筛选官方角色", async () => {
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "年龄段" }));
    await user.click(await screen.findByRole("option", { name: "30–39岁" }));
    expect(screen.getByText("职场精英")).toBeVisible();
    expect(screen.queryByText("都市女生")).not.toBeInTheDocument();
  });

  it("覆盖青年、中年和长辈的年龄筛选", async () => {
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "年龄段" }));
    await user.click(await screen.findByRole("option", { name: "20岁以下" }));
    expect(screen.getByText("甜美大学生")).toBeVisible();
    expect(screen.queryByText("优雅婆婆")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "年龄段" }));
    await user.click(await screen.findByRole("option", { name: "40–59岁" }));
    expect(screen.getByText("优雅婆婆")).toBeVisible();
    expect(screen.queryByText("甜美大学生")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "年龄段" }));
    await user.click(await screen.findByRole("option", { name: "60岁以上" }));
    expect(screen.getByText("睿智长辈")).toBeVisible();
    expect(screen.queryByText("优雅婆婆")).not.toBeInTheDocument();
  });

  it("支持按风格筛选并恢复全部角色", async () => {
    const user = userEvent.setup();
    render(<CharacterLibrary locale="zh" authenticated={false} />);
    await user.click(screen.getByRole("combobox", { name: "风格" }));
    await user.click(await screen.findByRole("option", { name: "古风" }));
    expect(screen.getByText("古风侠客")).toBeVisible();
    expect(screen.queryByText("都市女生")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "风格" }));
    await user.click(await screen.findByRole("option", { name: "全部风格" }));
    expect(screen.getByText("都市女生")).toBeVisible();
  });

  it("登录用户可查看个人角色并进入对应编辑页", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{ id: "42", name: "我的角色", has_preview: true }] }), { status: 200 })));
    render(<CharacterLibrary locale="zh" authenticated />);
    fireEvent.click(screen.getByRole("tab", { name: "我的角色库" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /编辑我的角色/ })).toHaveAttribute("href", "/character-setting?asset=42"));
    expect(screen.getByAltText("我的角色")).toHaveAttribute("src", "/api/character-assets/42/image");
  });

  it("个人角色满一页时可以加载更多", async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, name: `角色${index + 1}`, has_preview: false }));
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: first }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [{ id: 101, name: "角色101", has_preview: false }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterLibrary locale="zh" authenticated />);
    fireEvent.click(screen.getByRole("tab", { name: "我的角色库" }));
    fireEvent.click(await screen.findByRole("button", { name: "加载更多" }));
    expect(await screen.findByText("角色101")).toBeVisible();
    expect(fetcher.mock.calls[1][0]).toBe("/api/character-assets?limit=100&offset=100");
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
  });

  it("删除个人角色需确认，取消不发送请求", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [{ id: "42", name: "我的角色", has_preview: false }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterLibrary locale="zh" authenticated initialTab="mine" />);
    fireEvent.click(await screen.findByRole("button", { name: "删除我的角色" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("删除角色");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText("我的角色")).toBeVisible();
  });

  it("确认删除后移除个人角色", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [{ id: "42", name: "我的角色", has_preview: false }] }), { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterLibrary locale="zh" authenticated initialTab="mine" />);
    fireEvent.click(await screen.findByRole("button", { name: "删除我的角色" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.queryByText("我的角色")).not.toBeInTheDocument());
    expect(fetcher.mock.calls[1][0]).toBe("/api/character-assets/42");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("删除失败时保留角色并提示重试", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [{ id: "42", name: "我的角色", has_preview: false }] }), { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterLibrary locale="zh" authenticated initialTab="mine" />);
    fireEvent.click(await screen.findByRole("button", { name: "删除我的角色" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("删除失败，请重试");
    expect(screen.getByText("我的角色")).toBeInTheDocument();
  });
});
