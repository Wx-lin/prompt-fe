import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterBuilder } from "./character-builder";
import { createInitialValues } from "./character-data";
import { characterDraftKey } from "./character-draft-scope";

vi.mock("@/features/gallery/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./character-draft-images", () => ({ storeDraftImage: vi.fn().mockResolvedValue(true), readDraftImage: vi.fn().mockResolvedValue(null) }));
const user = { id: "u1", email: null, nickname: null, avatar_url: null, created_at: "2026-01-01" };
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); history.replaceState(null, "", "/character-setting?new=1"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState(null, "", "/"); });

describe("AI 描述创建角色", () => {
  it("用解析后的同一份配置更新提示词并生成图片", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: { age: "30岁", gender: "男性", hairLength: "长发", top: "白衬衫" }, unmapped: "右手有细疤" } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "30岁长发男性，白衬衫，右手有细疤" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await screen.findByAltText("AI 生成的角色预览");
    expect(fetcher.mock.calls[0][0]).toBe("/api/character-interpret");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).current_details).toBe("");
    expect(fetcher.mock.calls[1][0]).toBe("/api/character-preview");
    const imagePrompt = JSON.parse(fetcher.mock.calls[1][1].body).prompt;
    expect(imagePrompt).toContain("30岁");
    expect(imagePrompt).toContain("白衬衫");
    expect(imagePrompt).toContain("右手有细疤");
    expect(imagePrompt).not.toContain("运动背心");
    expect(imagePrompt).not.toContain("造型补充：不指定");
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("右手有细疤");
    expect(screen.getByText("本次生成结果")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "三视图设定板" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("白衬衫");
  });

  it("将已有 AI 补充细节传给解析模型并保留新旧细节", async () => {
    const values = { ...createInitialValues(), aiDetails: "左手有疤" };
    sessionStorage.setItem(characterDraftKey("?new=1"), JSON.stringify({ version: 1, preset: { name: "草稿", values, template: "basic", model: "通用" } }));
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: {}, unmapped: "左手有疤；戴银戒" } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    await screen.findByLabelText("描述角色，AI 快速创建");
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "戴银戒" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await screen.findByAltText("AI 生成的角色预览");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ description: "戴银戒", current_details: "左手有疤" });
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("左手有疤；戴银戒");
    expect(JSON.parse(fetcher.mock.calls[1][1].body).prompt).toContain("左手有疤；戴银戒");
  });

  it("未登录时保留输入并提示登录，不发送请求", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "一位年轻的医生" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("登录后生成角色预览");
    expect(screen.getByLabelText("描述角色，AI 快速创建")).toHaveValue("一位年轻的医生");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("图片生成失败时保留更新的配置与输入，提示可重试", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: { age: "35岁" }, unmapped: "" } }), { status: 200 })).mockResolvedValueOnce(new Response(null, { status: 503 })));
    render(<CharacterBuilder user={user} />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "35岁角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/生成/));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("35岁");
    expect(screen.getByLabelText("描述角色，AI 快速创建")).toHaveValue("35岁角色");
  });

  it("恢复新建草稿后不会将没有编辑过的示例配置混入 AI 角色", async () => {
    const values = { ...createInitialValues(), name: "手工名字" };
    sessionStorage.setItem(characterDraftKey("?new=1"), JSON.stringify({ version: 1, preset: { name: "草稿", values, template: "basic", model: "通用" } }));
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: { age: "30岁" }, unmapped: "" } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    await screen.findByLabelText("描述角色，AI 快速创建");
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "30岁的角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await screen.findByAltText("AI 生成的角色预览");
    const prompt = JSON.parse(fetcher.mock.calls[1][1].body).prompt;
    expect(prompt).not.toContain("运动背心");
    expect(prompt).toContain("手工名字");
  });

  it("等待解析时锁定输入，避免输入内容和实际生成结果不一致", async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => { complete = resolve; })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    const input = screen.getByLabelText("描述角色，AI 快速创建");
    fireEvent.change(input, { target: { value: "30岁角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    expect(input).toBeDisabled();
    complete(new Response(JSON.stringify({ data: { values: { age: "30岁" }, unmapped: "" } }), { status: 200 }));
    await screen.findByAltText("AI 生成的角色预览");
    expect(input).toBeEnabled();
  });

  it("新建角色保存时不会中断正在生成的请求", async () => {
    let completeImage!: (response: Response) => void;
    const image = new Promise<Response>((resolve) => { completeImage = resolve; });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: { age: "30岁" }, unmapped: "" } }), { status: 200 })).mockReturnValueOnce(image).mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "saved" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "30岁的角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const signal = fetcher.mock.calls[1][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "保存到我的角色库" }));
    await screen.findByText("已保存到我的角色库。");
    expect(signal.aborted).toBe(false);
    completeImage(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    await screen.findByAltText("AI 生成的角色预览");
  });

  it("解析过程中首次保存后仍使用新建角色策略清除示例默认值", async () => {
    let completeInterpretation!: (response: Response) => void;
    const interpretation = new Promise<Response>((resolve) => { completeInterpretation = resolve; });
    const fetcher = vi.fn().mockReturnValueOnce(interpretation).mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "saved" } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "30岁的角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    fireEvent.click(screen.getByRole("button", { name: "保存到我的角色库" }));
    await screen.findByText("已保存到我的角色库。");
    completeInterpretation(new Response(JSON.stringify({ data: { values: { age: "30岁" }, unmapped: "" } }), { status: 200 }));
    await screen.findByAltText("AI 生成的角色预览");
    expect(JSON.parse(fetcher.mock.calls[2][1].body).prompt).not.toContain("运动背心");
  });

  it("解析期间手动更改配置时，不覆盖新修改或发起生图", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => { complete = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "30岁的角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    fireEvent.change(screen.getAllByLabelText("角色姓名")[0], { target: { value: "刚修改的名字" } });
    complete(new Response(JSON.stringify({ data: { values: { name: "AI 名字" }, unmapped: "" } }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("配置已变更"));
    expect(screen.getAllByLabelText("角色姓名")[0]).toHaveValue("刚修改的名字");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("AI 更新可以撤销并恢复原配置", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { values: { age: "35岁" }, unmapped: "" } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    fireEvent.change(screen.getByLabelText("描述角色，AI 快速创建"), { target: { value: "35岁角色" } });
    fireEvent.click(screen.getByRole("button", { name: "生成角色" }));
    await screen.findByAltText("AI 生成的角色预览");
    fireEvent.click(screen.getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("25岁");
    expect(screen.getByText("配置已更改，当前展示上次生成结果")).toBeVisible();
  });
});
