import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CharacterBuilder } from "./character-builder";
import { createInitialValues } from "./character-data";
import { buildOutputs } from "./prompt-builder";
import { DRAFT_KEY, PRESET_KEY, parseFile } from "./character-presets";

vi.mock("@/features/gallery/components/site-header", () => ({ SiteHeader: () => <span>提示词创作</span> }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: React.MouseEventHandler }) => <a href={href} onClick={onClick}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("角色设定工作台", () => {
  it("重复点击已选套装不会清除后续调整的服装细节", () => {
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "经典西装" }));
    const settings = within(screen.getByRole("region", { name: "角色设置" }));
    fireEvent.click(settings.getByText("服装造型"));
    const material = within(screen.getByRole("region", { name: "角色设置" })).getByLabelText("材质");
    fireEvent.change(material, { target: { value: "羊毛" } });
    fireEvent.keyDown(material, { key: "Enter", ctrlKey: true });
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("羊毛");
    fireEvent.click(screen.getByRole("button", { name: "经典西装" }));
    expect(material).toHaveValue("羊毛");
  });

  it("套装替换服装配置可撤销，并保留其他角色配置", () => {
    const initial = createInitialValues();
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "自定义角色" } });
    fireEvent.click(screen.getByRole("button", { name: "经典西装" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("黑色西装外套");
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("已替换服装配置");
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "换装后修改的角色" } });
    fireEvent.click(within(notice).getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent(initial.top);
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent(initial.clothingColor);
    expect(screen.getByLabelText("角色姓名")).toHaveValue("换装后修改的角色");
    expect(screen.getByRole("button", { name: "经典西装" })).toHaveAttribute("aria-pressed", "false");
  });

  it("新风格套装替换后可撤销并恢复原服装", () => {
    const initial = createInitialValues();
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "古风" }));
    fireEvent.click(screen.getByRole("button", { name: "粉色汉服" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("粉色汉服上衣");
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent(initial.top);
    expect(screen.getByRole("button", { name: "粉色汉服" })).toHaveAttribute("aria-pressed", "false");
  });

  it("重置后的撤销操作在提示旁可见，继续编辑或切换模板也不会丢失", () => {
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "重置前角色" } });
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    const notice = screen.getByRole("status");
    expect(within(notice).getByRole("button", { name: "撤销替换" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "重置后编辑" } });
    fireEvent.click(screen.getByRole("button", { name: "表情设定板" }));
    fireEvent.click(screen.getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("重置前角色");
  });

  it("搜索选项值并保持搜索前展开的配置组", () => {
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByText("高级设置与提示词预览"));
    fireEvent.click(within(screen.getByRole("region", { name: "角色设置" })).getByText("脸部五官"));
    expect(screen.getByRole("combobox", { name: "脸型" })).toBeVisible();
    const search = screen.getByPlaceholderText("搜索配置项");
    fireEvent.change(search, { target: { value: "短发" } });
    expect(screen.getByRole("combobox", { name: "头发长度" })).toBeVisible();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("combobox", { name: "脸型" })).toBeVisible();
  });

  it("复制结果在当前预览复制按钮附近展示", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CharacterBuilder />);
    const preview = screen.getByLabelText("提示词预览");
    fireEvent.click(within(preview).getByRole("button", { name: "复制提示词" }));
    expect(await within(preview).findByRole("status")).toHaveTextContent("已复制");
  });

  it("新访客和重置使用完整默认值，同时允许撤销回到已有草稿", () => {
    const defaults = createInitialValues();
    expect(defaults.occupation).not.toBe("");
    expect(defaults.faceShape).not.toBe("");
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("职业／身份")).toHaveValue(defaults.occupation);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "我自己的角色" } });
    fireEvent.change(screen.getByLabelText("职业／身份"), { target: { value: "" } });
    fireEvent.keyDown(screen.getByLabelText("职业／身份"), { key: "Enter", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    expect(screen.getByLabelText("职业／身份")).toHaveValue(defaults.occupation);
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.click(screen.getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("我自己的角色");
    expect(screen.getByLabelText("职业／身份")).toHaveValue("");
  });

  it("恢复旧草稿时保留显式空值及自定义内容，不用新默认覆盖", () => {
    const old = { name: "草稿", values: { ...createInitialValues(), name: "旧草稿人物", occupation: "", faceShape: "自定义脸型" }, template: "basic", model: "通用" };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, preset: old }));
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("角色姓名")).toHaveValue("旧草稿人物");
    expect(screen.getByLabelText("职业／身份")).toHaveValue("");
    fireEvent.click(within(screen.getByRole("region", { name: "角色设置" })).getByText("脸部五官"));
    expect(screen.getByRole("combobox", { name: /^脸型/ })).toHaveValue("自定义脸型");
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!).preset.values.occupation).toBe("");
  });

  it("应用本机旧预设时保留显式空值及自定义内容", async () => {
    const old = { name: "旧预设", values: { ...createInitialValues(), name: "旧预设人物", occupation: "", faceShape: "自定义脸型" }, template: "basic", model: "通用" };
    localStorage.setItem(PRESET_KEY, JSON.stringify([old]));
    render(<CharacterBuilder />);
    const user = userEvent.setup();
    await user.click(screen.getByText("预设管理"));
    await user.click(screen.getByLabelText("选择预设"));
    await user.click(await screen.findByRole("option", { name: "旧预设" }));
    fireEvent.click(screen.getByRole("button", { name: "应用预设" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("旧预设人物");
    expect(screen.getByLabelText("职业／身份")).toHaveValue("");
    fireEvent.click(within(screen.getByRole("region", { name: "角色设置" })).getByText("脸部五官"));
    expect(screen.getByRole("combobox", { name: /^脸型/ })).toHaveValue("自定义脸型");
    expect(JSON.parse(localStorage.getItem(PRESET_KEY)!)[0].values.occupation).toBe("");
  });

  it("提供全部配置分组及六种模板，并更新预览", () => {
    render(<CharacterBuilder />);
    const settings = within(screen.getByRole("region", { name: "角色设置" }));
    expect(settings.getByText("基础信息")).toBeInTheDocument();
    expect(settings.getByText("一致性锁定")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "江小雨" } });
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("江小雨");
    fireEvent.click(screen.getByRole("button", { name: "三视图设定板" }));
    expect(screen.getByRole("button", { name: "三视图设定板" })).toHaveAttribute("aria-pressed", "true");
  });

  it("只在用户明确保存时写入本地预设，并可应用与删除", async () => {
    render(<CharacterBuilder />);
    const user = userEvent.setup();
    await user.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "白鹿" } });
    expect(localStorage.length).toBe(0);
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "我的角色" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    expect(screen.getByRole("status")).toHaveTextContent("本机");
    expect(localStorage.length).toBe(1);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "另一个角色" } });
    expect(screen.getByLabelText("选择预设")).toHaveTextContent("我的角色");
    fireEvent.click(screen.getByRole("button", { name: "应用预设" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("白鹿");
    fireEvent.click(screen.getByRole("button", { name: "删除预设" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));
    expect(screen.queryByRole("option", { name: "我的角色" })).not.toBeInTheDocument();
  });

  it("复制失败给出可操作提示", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "复制提示词" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("手动复制");
  });

  it("内置预设不可删除，应用后可以撤销原有输入", async () => {
    render(<CharacterBuilder />);
    const user = userEvent.setup();
    await user.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "自己的角色" } });
    const select = screen.getByLabelText("选择预设");
    select.focus();
    await user.keyboard("{ArrowDown}");
    await user.click(await screen.findByRole("option", { name: "古风行旅角色" }));
    expect(screen.getByRole("button", { name: "删除预设" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "应用预设" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("云衡");
    fireEvent.click(screen.getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("自己的角色");
  });

  it("有未保存配置时，返回首页会提示并允许继续编辑", () => {
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "未保存角色" } });
    fireEvent.click(screen.getByRole("link", { name: "返回首页" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("未保存");
    fireEvent.click(within(dialog).getByRole("button", { name: "继续编辑" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("未保存角色");
  });

  it("JSON 预览和导出封装都可以导入，恶意或不兼容内容会拒绝", () => {
    const values = { ...createInitialValues(), name: "JSON 角色" };
    const json = buildOutputs(values, "basic", "通用").json;
    expect(parseFile(json)?.values.name).toBe("JSON 角色");
    expect(parseFile(JSON.stringify({ version: 1, preset: { name: "备份", template: "basic", model: "通用", values } }))?.values.name).toBe("JSON 角色");
    expect(parseFile(JSON.stringify({ version: 999, preset: { name: "备份", template: "basic", model: "通用", values } }))).toBeNull();
    expect(parseFile(JSON.stringify({ version: 1, template: "basic", model: "通用", values: { name: 17 } }))).toBeNull();
    expect(parseFile(JSON.stringify({ version: 1, template: "basic", model: "通用", values: { constructor: "evil" } }))).toBeNull();
    expect(parseFile(JSON.stringify({ version: 1, template: "basic", model: "通用", values: { shotCount: "-3" } }))).toBeNull();
    expect(parseFile(JSON.stringify({ version: 1, template: "basic", model: "通用", values: { steps: "12.5" } }))).toBeNull();
    expect(parseFile(JSON.stringify({ version: 1, template: "basic", model: "通用", values: { personality: "A".repeat(2001) } }))).toBeNull();
  });

  it("预设名字使用 builtin: 前缀时仍能保存并应用本机条目", async () => {
    render(<CharacterBuilder />);
    const user = userEvent.setup();
    await user.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "builtin:私人" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "另一个人" } });
    fireEvent.click(screen.getByRole("button", { name: "应用预设" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("新角色");
    expect(screen.getByRole("button", { name: "删除预设" })).toBeEnabled();
  });

  it("导入无效及超大文件有提示，合法配置导入可撤销", async () => {
    render(<CharacterBuilder />);
    const input = screen.getByLabelText("导入配置文件");
    const invalid = new File(["{}"], "invalid.json", { type: "application/json" });
    Object.defineProperty(invalid, "text", { value: async () => "{}" });
    fireEvent.change(input, { target: { files: [invalid] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("文件格式无效");
    const huge = new File([new Uint8Array(262145)], "large.json");
    fireEvent.change(input, { target: { files: [huge] } });
    expect(screen.getByRole("alert")).toHaveTextContent("256 KB");
    const json = buildOutputs({ ...createInitialValues(), name: "已导入" }, "basic", "通用").json;
    const valid = new File([json], "valid.json", { type: "application/json" });
    Object.defineProperty(valid, "text", { value: async () => json });
    fireEvent.change(input, { target: { files: [valid] } });
    await waitFor(() => expect(screen.getByLabelText("角色姓名")).toHaveValue("已导入"));
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.click(screen.getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("新角色");
  });

  it("存储被禁用时提示失败且保留当前输入", () => {
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "保留我" } });
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "保存失败" } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    expect(screen.getByRole("alert")).toHaveTextContent("无法保存到本机");
    expect(screen.getByLabelText("角色姓名")).toHaveValue("保留我");
  });

  it("标签页草稿恢复，以及其他标签页保存的预设不会被覆盖", () => {
    const old = { name: "其他标签页", values: createInitialValues(), template: "basic", model: "通用" };
    const draft = { name: "草稿", values: { ...createInitialValues(), name: "草稿中的人" }, template: "basic", model: "通用" };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, preset: draft }));
    render(<CharacterBuilder />);
    expect(screen.getByLabelText("角色姓名")).toHaveValue("草稿中的人");
    fireEvent.click(screen.getByText("预设管理"));
    localStorage.setItem(PRESET_KEY, JSON.stringify([old]));
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "当前标签页" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    expect(JSON.parse(localStorage.getItem(PRESET_KEY)!).map((item: { name: string }) => item.name)).toEqual(["其他标签页", "当前标签页"]);
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!).preset.values.name).toBe("草稿中的人");
  });

  it("删除当前配置唯一预设后返回首页重新提示", () => {
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "待保存" } });
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "仅有一份" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    fireEvent.click(screen.getByRole("button", { name: "删除预设" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "确认删除" }));
    fireEvent.click(screen.getByRole("link", { name: "返回首页" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("未保存");
  });

  it("其他标签页删除当前预设时提示重新保存并保护未保存数据", () => {
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "当前角色" } });
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "唯一备份" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    localStorage.setItem(PRESET_KEY, "[]");
    fireEvent(window, new StorageEvent("storage", { key: PRESET_KEY, newValue: "[]" }));
    expect(screen.getByRole("alert")).toHaveTextContent("其他标签页");
    fireEvent.click(screen.getByRole("link", { name: "返回首页" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("未保存");
  });

  it("输出和字段搜索都可以即时切换", async () => {
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByText("高级设置与提示词预览"));
    fireEvent.click(screen.getByRole("button", { name: /^英文$/ }));
    expect(screen.getByText(/不会自动翻译/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "中英双语" }));
    expect(screen.getByLabelText("提示词内容")).toHaveTextContent("Character");
    fireEvent.change(screen.getByPlaceholderText("搜索配置项"), { target: { value: "不存在的字段" } });
    expect(screen.getByText("没有找到相关配置项。")).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("搜索配置项"), { target: { value: "分镜张数" } });
    expect(screen.getByRole("spinbutton", { name: /连续分镜张数/ })).toBeVisible();
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboard } });
    fireEvent.click(screen.getByRole("button", { name: "复制提示词" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("已复制");
  });

  it("同名预设冲突不会覆盖其他标签页的数据", () => {
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByText("预设管理"));
    const other = { name: "同名", values: { ...createInitialValues(), name: "别人的角色" }, template: "basic", model: "通用" };
    localStorage.setItem(PRESET_KEY, JSON.stringify([other]));
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "同名" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    expect(screen.getByRole("alert")).toHaveTextContent("已存在");
    expect(JSON.parse(localStorage.getItem(PRESET_KEY)!)[0].values.name).toBe("别人的角色");
  });

  it("损坏的本机预设不会被保存操作覆盖", () => {
    localStorage.setItem(PRESET_KEY, "not-json");
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.change(screen.getByLabelText("预设名称"), { target: { value: "新的" } });
    fireEvent.click(screen.getByRole("button", { name: "保存预设" }));
    expect(screen.getByRole("alert")).toHaveTextContent("未覆盖已有数据");
    expect(localStorage.getItem(PRESET_KEY)).toBe("not-json");
  });

  it("未保存时浏览器关闭会请求确认，恢复默认后可以撤销", () => {
    render(<CharacterBuilder />);
    fireEvent.change(screen.getByLabelText("角色姓名"), { target: { value: "我的草稿" } });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("新角色");
    fireEvent.click(screen.getByText("预设管理"));
    fireEvent.click(screen.getByRole("button", { name: "撤销替换" }));
    expect(screen.getByLabelText("角色姓名")).toHaveValue("我的草稿");
  });

  it("导出配置使用兼容的 JSON 文件", () => {
    const create = vi.fn().mockReturnValue("blob:character");
    const revoke = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    render(<CharacterBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "导出" }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:character");
    expect(screen.getByRole("status")).toHaveTextContent("配置已导出");
  });

  it("英文界面显示提示与基本操作", () => {
    render(<CharacterBuilder locale="en" />);
    fireEvent.click(screen.getByText("Advanced settings and prompt preview"));
    expect(screen.getByRole("heading", { name: "Character setup" })).toBeVisible();
    expect(screen.getByLabelText("Character name")).toHaveValue("新角色");
    fireEvent.click(screen.getByRole("button", { name: /^English$/ }));
    expect(screen.getByText(/not automatically translated/)).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("Search settings"), { target: { value: "no-such-setting" } });
    expect(screen.getByText("No matching settings.")).toBeVisible();
  });
});
