import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterBuilder } from "./character-builder";
import { createInitialValues } from "./character-data";
import { DRAFT_KEY } from "./character-presets";
import { characterDraftKey, markCharacterFreshStart, markCharacterLoginResume } from "./character-draft-scope";
import { readDraftImage, storeDraftImage } from "./character-draft-images";

vi.mock("@/features/gallery/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./character-draft-images", () => ({ storeDraftImage: vi.fn().mockResolvedValue(true), readDraftImage: vi.fn().mockResolvedValue(null) }));

const user = { id: "u1", email: null, nickname: null, avatar_url: null, created_at: "2026-01-01" };
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.mocked(readDraftImage).mockResolvedValue(null); vi.mocked(storeDraftImage).mockClear(); history.replaceState(null, "", "/character-setting"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState(null, "", "/"); });

describe("角色资产编辑", () => {
  it("旧角色图片签名缺少新增的 AI 补充字段时仍是当前预览", async () => {
    history.replaceState(null, "", "/character-setting?asset=old");
    const values = createInitialValues();
    delete values.aiDetails;
    const preview_signature = JSON.stringify([values, null, values.outfitNotes, "平静"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "old", name: values.name, values, template: "basic", model: "通用", preview_image_base64: "dGVzdA==", preview_signature } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    await screen.findByAltText("AI 生成的角色预览");
    expect(screen.getByText("本次生成结果")).toBeVisible();
  });
  it("未登录保存时提示登录且不发送请求", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "保存到我的角色库" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("登录后保存角色");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("新建入口不会读取旧的新建草稿，登录回跳则恢复当前设定", () => {
    history.replaceState(null, "", "/character-setting?new=1");
    const key = characterDraftKey("?new=1");
    const draft = { name: "草稿", values: { ...createInitialValues(), name: "登录前编辑" }, template: "basic", model: "通用" };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, preset: { ...draft, values: { ...draft.values, name: "无关旧草稿" } } }));
    sessionStorage.setItem(key, JSON.stringify({ version: 1, preset: draft }));
    markCharacterLoginResume();
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("角色姓名")).toHaveValue("登录前编辑");
  });
  it("再次从角色库新建时，不会沿用之前的新建草稿", () => {
    history.replaceState(null, "", "/character-setting?new=1");
    const draft = { name: "草稿", values: { ...createInitialValues(), name: "之前的新角色" }, template: "basic", model: "通用" };
    sessionStorage.setItem(characterDraftKey("?new=1"), JSON.stringify({ version: 1, preset: draft }));
    markCharacterFreshStart("?new=1");
    render(<CharacterBuilder />);
    expect(screen.getAllByLabelText("角色姓名")[0]).not.toHaveValue("之前的新角色");
  });
  it("刷新同一新建页面时恢复该页面自己的草稿", () => {
    history.replaceState(null, "", "/character-setting?new=1");
    const draft = { name: "草稿", values: { ...createInitialValues(), name: "刷新前编辑" }, template: "basic", model: "通用" };
    sessionStorage.setItem(characterDraftKey("?new=1"), JSON.stringify({ version: 1, preset: draft }));
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("角色姓名")).toHaveValue("刷新前编辑");
  });
  it("从角色库选择官方角色不被其他角色的草稿覆盖", () => {
    history.replaceState(null, "", "/character-setting?preset=urban-man");
    const draft = { name: "草稿", values: { ...createInitialValues(), name: "旧角色" }, template: "basic", model: "通用" };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, preset: draft }));
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("角色姓名")).toHaveValue("阳光青年");
  });
  it.each([
    ["drama-01-01", "甜宠实习生", "女性", "实习生", "粉色开衫", "白色百褶裙", "白色运动鞋"],
    ["drama-07-01", "尊贵皇后", "女性", "皇后", "红金色凤袍", "红金色长裙", "红色鞋"],
    ["drama-12-03", "优雅婆婆", "女性", "母亲", "酒红色上衣", "黑色长裤", "黑色鞋"],
    ["drama-01-03", "霸总", "男性", "总裁", "黑色西装和白衬衫", "黑色西裤", "黑色皮鞋"],
  ])("从真实预设 URL 加载 %s 的角色信息和对应示例图", (id, name, gender, occupation, top, bottom, shoes) => {
    history.replaceState(null, "", `/character-setting?preset=${id}`);
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("角色姓名")).toHaveValue(name);
    expect(screen.getByLabelText("性别")).toHaveValue(gender);
    expect(screen.getByLabelText("职业／身份")).toHaveValue(occupation);
    expect(decodeURIComponent(screen.getByAltText("角色示例图").getAttribute("src") ?? "")).toContain(`/character-library/${id}-hd.webp`);
    const prompt = screen.getByLabelText("提示词内容");
    expect(prompt).toHaveTextContent(top);
    expect(prompt).toHaveTextContent(bottom);
    expect(prompt).toHaveTextContent(shoes);
  });
  it("从库返回同一官方角色时恢复该角色的未保存草稿", async () => {
    history.replaceState(null, "", "/character-setting?preset=urban-man");
    const draft = { name: "草稿", values: { ...createInitialValues(), name: "未保存的青年" }, template: "basic", model: "通用" };
    sessionStorage.setItem(characterDraftKey("?preset=urban-man"), JSON.stringify({ version: 1, preset: draft }));
    render(<CharacterBuilder />);
    await waitFor(() => expect(screen.getByLabelText("角色姓名")).toHaveValue("未保存的青年"));
  });
  it("生成后保存角色设定、模型和图片及其生成时签名", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "a1" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await screen.findByAltText("AI 生成的角色预览");
    fireEvent.click(screen.getByRole("button", { name: "保存到我的角色库" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const [url, init] = fetcher.mock.calls[1];
    const data = JSON.parse(init.body);
    expect(url).toBe("/api/character-assets");
    expect(data).toMatchObject({ template: "basic", model: "通用", preview_image_base64: "dGVzdA==" });
    expect(data.values.name).toBeTruthy();
    expect(data.preview_signature).toContain(data.values.name);
  });
  it("保存期间生成新图，不会删除尚未保存的新图草稿", async () => {
    let completeSave!: (response: Response) => void;
    const save = new Promise<Response>((resolve) => { completeSave = resolve; });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "ZGF0YTE=", mime_type: "image/png" } }), { status: 200 })).mockReturnValueOnce(save).mockResolvedValueOnce(new Response(JSON.stringify({ data: { image_base64: "ZGF0YTI=", mime_type: "image/png" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await screen.findByAltText("AI 生成的角色预览");
    fireEvent.click(screen.getByRole("button", { name: "保存到我的角色库" }));
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(screen.getByAltText("AI 生成的角色预览")).toHaveAttribute("src", "data:image/png;base64,ZGF0YTI="));
    completeSave(new Response(JSON.stringify({ data: { id: "a1" } }), { status: 200 }));
    await waitFor(() => expect(screen.getByText("已保存到我的角色库。")).toBeVisible());
    expect(vi.mocked(storeDraftImage)).not.toHaveBeenCalledWith(expect.anything(), null);
    await waitFor(() => expect(vi.mocked(storeDraftImage)).toHaveBeenCalledWith(characterDraftKey("?asset=a1"), expect.objectContaining({ src: "data:image/png;base64,ZGF0YTI=" })));
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("从资产打开时恢复数据和图片，并标记旧图片", async () => {
    history.replaceState(null, "", "/character-setting?asset=a1");
    const values = { ...createInitialValues(), name: "保存的角色" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "a1", name: "保存的角色", values, template: "basic", model: "通用", preview_image_base64: "dGVzdA==", preview_signature: "[]" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    await screen.findByAltText("AI 生成的角色预览");
    expect(screen.getByText("配置已更改，当前展示上次生成结果")).toBeVisible();
    expect(screen.getByLabelText("角色姓名")).toHaveValue("保存的角色");
  });
  it("从库返回个人角色时保留该角色未保存的草稿", async () => {
    history.replaceState(null, "", "/character-setting?asset=a1");
    const saved = { ...createInitialValues(), name: "已保存" };
    const draft = { name: "草稿", values: { ...saved, name: "未保存的修改" }, template: "basic", model: "通用" };
    sessionStorage.setItem(characterDraftKey("?asset=a1"), JSON.stringify({ version: 1, preset: draft }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "a1", name: "已保存", values: saved, template: "basic", model: "通用" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    await waitFor(() => expect(screen.getByLabelText("角色姓名")).toHaveValue("未保存的修改"));
  });
  it("没有图片的个人角色显示中性占位，而非其他角色的示例图", async () => {
    history.replaceState(null, "", "/character-setting?asset=a1");
    const values = { ...createInitialValues(), name: "我的角色", gender: "男性" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "a1", name: "我的角色", values, template: "basic", model: "通用" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    expect(await screen.findByText("尚未生成角色预览")).toBeVisible();
    expect(screen.queryByAltText("角色示例图")).not.toBeInTheDocument();
  });
  it("重新打开资产时恢复所选输出语言", async () => {
    history.replaceState(null, "", "/character-setting?asset=a1");
    const values = { ...createInitialValues(), name: "英文角色", outputLanguage: "英文" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "a1", name: "英文角色", values, template: "basic", model: "通用" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    await waitFor(() => expect(screen.getByLabelText("提示词内容")).toHaveTextContent("Character"));
  });
  it("切换提示词语言后保存该语言到角色资产", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "a1" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<CharacterBuilder user={user} />);
    fireEvent.click(screen.getByText("高级设置与提示词预览"));
    fireEvent.click(screen.getByRole("button", { name: /^英文$/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存到我的角色库" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body).values.outputLanguage).toBe("英文");
  });
  it("仅生成新图片也会在刷新时触发未保存提醒", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 })));
    render(<CharacterBuilder user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await screen.findByAltText("AI 生成的角色预览");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("刷新时恢复未保存的预览图而非悄悄退回示例图", async () => {
    history.replaceState(null, "", "/character-setting?new=1");
    const draft = { name: "草稿", values: createInitialValues(), template: "basic", model: "通用" };
    sessionStorage.setItem(characterDraftKey("?new=1"), JSON.stringify({ version: 1, preset: draft }));
    vi.mocked(readDraftImage).mockResolvedValue({ src: "data:image/png;base64,dGVzdA==", signature: "[]" });
    render(<CharacterBuilder user={user} />);
    await screen.findByAltText("AI 生成的角色预览");
    expect(screen.getByText("配置已更改，当前展示上次生成结果")).toBeVisible();
  });
  it("个人角色登录失效时提供回到原角色的登录入口", async () => {
    history.replaceState(null, "", "/character-setting?asset=42");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<CharacterBuilder />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("登录后打开角色");
    expect(dialog.querySelector("a")?.getAttribute("href")).toContain(encodeURIComponent("/character-setting?asset=42"));
    fireEvent.click(screen.getByRole("button", { name: "稍后再说" }));
    expect(screen.getByRole("button", { name: "保存到我的角色库" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "登录后打开角色" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("登录后打开角色");
  });
});
