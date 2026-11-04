import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/brand/brand-logo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/theme-provider/theme-toggle-control", () => ({ ThemeToggleControl: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import { CharacterDemo } from "./character-demo";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("角色工作台", () => {
  it("提示 GPT 图像生成及自动更新的计费方式", () => {
    render(<CharacterDemo />);
    expect(screen.getByText(/GPT 图像模型/)).toBeVisible();
    expect(screen.getByText(/每次调用可能产生费用/)).toBeVisible();
    expect(screen.queryByText(/百炼|Qwen|¥0.20/)).not.toBeInTheDocument();
  });
  it("展示角色参考图和 4 类配置，选择时保留其他类别", () => {
    render(<CharacterDemo />);
    expect(screen.getByRole("img", { name: "角色参考图：都市女性" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "角色" }));
    fireEvent.click(screen.getByRole("button", { name: "都市男性" }));
    expect(screen.getByRole("img", { name: "角色参考图：都市男性" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "服装" }));
    fireEvent.click(screen.getByRole("button", { name: "粉色百褶短裙" }));
    expect(screen.getByText(/角色：都市男性/)).toBeVisible();
    expect(screen.getByText(/下装：粉色百褶短裙/)).toBeVisible();
    expect(screen.getByText(/将角色下装改为粉色百褶短裙/)).toBeVisible();
    expect(screen.queryByRole("img", { name: "AI 生成的角色" })).not.toBeInTheDocument();
  });
  it("丝袜描述保留原服装", () => {
    render(<CharacterDemo />);
    fireEvent.click(screen.getByRole("button", { name: "服装" }));
    fireEvent.click(screen.getByRole("button", { name: "黑色透肤丝袜" }));
    expect(screen.getByText(/为角色穿上黑色透肤丝袜，保留现有服装/)).toBeVisible();
  });
  it("组合选择并调用接口，展示模型实际返回的图片", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "012345678901234567890123", image: "data:image/png;base64,dGVzdA==" }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    render(<CharacterDemo />);
    fireEvent.click(screen.getByRole("button", { name: "角色" }));
    fireEvent.click(screen.getByRole("button", { name: "都市男性" }));
    fireEvent.click(screen.getByRole("button", { name: "服装" }));
    fireEvent.click(screen.getByRole("button", { name: "粉色百褶短裙" }));
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "AI 生成的角色" })).toBeVisible());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ role: "都市男性" });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).clothing).toContain("粉色百褶短裙");
    fireEvent.click(screen.getByRole("button", { name: "恢复参考图" }));
    expect(screen.getByRole("img", { name: "角色参考图：都市男性" })).toBeVisible();
  });
  it("生成失败时显示错误，不显示伪造的生成结果", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<CharacterDemo />);
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/无法连接/));
    expect(screen.queryByRole("img", { name: "AI 生成的角色" })).not.toBeInTheDocument();
  });
  it("自动更新使用上一张图，换角色时改用新角色参考图", async () => {
    const image = "data:image/png;base64,dGVzdA==";
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "first-reference-123456789", image }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "second-reference-12345678", image }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "third-reference-123456789", image }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    render(<CharacterDemo />);
    fireEvent.click(screen.getByRole("checkbox", { name: "选择后自动更新" }));
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "AI 生成的角色" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "发型" }));
    fireEvent.click(screen.getByRole("button", { name: "长直发" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({ hair: "长直发", previous_id: "first-reference-123456789" });
    await waitFor(() => expect(screen.getByText("本次生成")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "角色" }));
    fireEvent.click(screen.getByRole("button", { name: "都市男性" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3), { timeout: 4000 });
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).not.toHaveProperty("previous_id");
  });

  it("短裙和丝袜可同时选择并一起提交", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "012345678901234567890123", image: "data:image/png;base64,dGVzdA==" }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    render(<CharacterDemo />);
    fireEvent.click(screen.getByRole("button", { name: "服装" }));
    fireEvent.click(screen.getByRole("button", { name: "柠檬黄针织开衫" }));
    fireEvent.click(screen.getByRole("button", { name: "粉色百褶短裙" }));
    fireEvent.click(screen.getByRole("button", { name: "黑色透肤丝袜" }));
    expect(screen.getByText(/服装：柠檬黄针织开衫/)).toBeVisible();
    expect(screen.getByText(/下装：粉色百褶短裙/)).toBeVisible();
    expect(screen.getByText(/丝袜：黑色透肤丝袜/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).clothing).toContain("粉色百褶短裙");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).clothing).toContain("黑色透肤丝袜");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).clothing).toContain("柠檬黄针织开衫");
  });

  it("参考图过期时停止自动更新并允许用户重新生成", async () => {
    const image = "data:image/png;base64,dGVzdA==";
    const mockFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "expired-reference-12345678", image }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: "参考图片已过期" }), { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "fresh-reference-1234567890", image }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    render(<CharacterDemo />);
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "重新生成" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/过期/));
    expect(screen.getByRole("button", { name: "生成角色" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).not.toHaveProperty("previous_id");
  });

});
