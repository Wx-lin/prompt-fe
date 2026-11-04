import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialValues } from "./character-data";
import { CharacterWorkbench } from "./character-workbench";

function Workspace() {
  const [values, setValues] = useState(createInitialValues);
  return <CharacterWorkbench values={values} en={false} canUndo={false} onChange={(id, value) => setValues((previous) => ({ ...previous, [id]: value }))} onApplyOutfit={(changes) => setValues((previous) => ({ ...previous, ...changes }))} />;
}

function enterCategory(name: string) {
  if (["脸部五官", "发型"].includes(name)) {
    fireEvent.click(screen.getByRole("button", { name: "脸部与发型" }));
    if (name === "发型") fireEvent.click(screen.getByRole("button", { name: "发型" }));
  } else if (["身材体态", "肤色皮肤"].includes(name)) {
    fireEvent.click(screen.getByRole("button", { name: "身材与皮肤" }));
    if (name === "肤色皮肤") fireEvent.click(screen.getByRole("button", { name: "肤色皮肤" }));
  } else if (name === "妆容配饰") {
    fireEvent.click(screen.getByRole("button", { name: "服装与妆饰" }));
    fireEvent.click(screen.getByRole("tab", { name: "造型" }));
    fireEvent.click(screen.getByRole("button", { name: "妆容配饰" }));
  } else fireEvent.click(screen.getByRole("button", { name: name === "表情动作" ? "表情与动作" : name }));
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("角色造型工作台", () => {
  it("现代风格有 100 套，并能切换与选择不同风格", () => {
    render(<Workspace />);
    const categories = [["现代", 100], ["古风", 8], ["仙侠", 6], ["民国", 6], ["科幻", 6], ["礼服", 6], ["民族", 6]] as const;
    for (const [category, count] of categories) {
      fireEvent.click(screen.getByRole("button", { name: category }));
      expect(within(screen.getByRole("group", { name: "可选套装" })).getAllByRole("button")).toHaveLength(count);
    }
  });

  it("恢复已选套装的风格，并允许用户浏览其他风格", () => {
    const values = { ...createInitialValues(), top: "粉色汉服上衣", bottom: "粉色飘逸长裙", shoes: "粉色布鞋" };
    render(<CharacterWorkbench values={values} en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "古风" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "粉色汉服" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "现代" }));
    expect(screen.getByRole("button", { name: "现代" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "日常便装" })).toBeVisible();
  });

  it("选中套装时保存对应类别且不覆盖补充描述", () => {
    const apply = vi.fn();
    render(<CharacterWorkbench values={createInitialValues()} en={false} canUndo={false} onChange={vi.fn()} onApplyOutfit={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "古风" }));
    fireEvent.click(screen.getByRole("button", { name: "粉色汉服" }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ clothingCategory: "古装", top: "粉色汉服上衣", bottom: "粉色飘逸长裙", shoes: "粉色布鞋" }));
    expect(apply.mock.calls[0][0]).not.toHaveProperty("outfitNotes");
  });

  it("选择新增青春套装后将完整搭配写入生图提示词", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "甜橙卫衣" }));
    expect(screen.getByRole("button", { name: "甜橙卫衣" })).toHaveAttribute("aria-pressed", "true");
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const prompt = JSON.parse(fetcher.mock.calls[0][1].body).prompt;
    expect(prompt).toContain("浅橙色卫衣");
    expect(prompt).toContain("白色休闲长裤");
    expect(prompt).toContain("白色运动鞋");
  });

  it("选择古风套装时应用对应服装并用于生图提示词", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "古风" }));
    fireEvent.click(screen.getByRole("button", { name: "粉色汉服" }));
    expect(screen.getByRole("button", { name: "粉色汉服" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body).prompt).toContain("粉色");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).prompt).toContain("汉服");
  });

  it("选择整套服装后才发起生成，使用当前角色配置和服装描述", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    const generate = screen.getByRole("button", { name: "确认生成" });
    expect(generate).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "日常便装" }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByText(/选择后预览不会立即变化/)).toBeVisible();
    fireEvent.click(generate);
    await waitFor(() => expect(screen.getByAltText("AI 生成的角色预览")).toBeVisible());
    const request = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(request.aspect_ratio).toBe("3:4");
    expect(request.prompt).toContain("T恤");
    expect(request.prompt).toContain("全身");
    expect(request.prompt).not.toContain("三视图");
    expect(request.prompt).not.toContain("运动背心");
  });

  it("可按部位选择脸型、发型、身材和多选表情，无需先选套装即可生成", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    enterCategory("脸部五官");
    fireEvent.click(screen.getByRole("button", { name: "圆脸" }));
    enterCategory("发型");
    fireEvent.click(screen.getByRole("button", { name: "马尾" }));
    enterCategory("身材体态");
    fireEvent.click(screen.getByRole("button", { name: "健壮" }));
    enterCategory("表情动作");
    fireEvent.click(screen.getByRole("button", { name: "愤怒" }));
    fireEvent.click(screen.getByRole("button", { name: "预览 微笑" }));
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    const request = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(request.prompt).toContain("圆脸");
    expect(request.prompt).toContain("马尾");
    expect(request.prompt).toContain("健壮");
    expect(request.prompt).not.toContain("愤怒");
    expect(request.prompt).toContain("微笑");
    expect(request.prompt).not.toContain("预览表情：平静");
    expect(request.prompt).toContain("运动背心");
  });

  it("五官示例有对应素材，支持自定义内容和表情多选", () => {
    render(<Workspace />);
    enterCategory("脸部五官");
    fireEvent.click(screen.getByRole("button", { name: "眼型" }));
    const almond = screen.getByRole("button", { name: "杏眼" });
    expect(almond.querySelector("[style]")?.getAttribute("style")).toContain("%2Fcharacter-visuals%2Feyes.png");
    fireEvent.click(screen.getByRole("button", { name: "圆眼" }));
    expect(screen.getByRole("button", { name: "圆眼" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "眼型 自定义" }), { target: { value: "自定义眼型" } });
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.getByRole("button", { name: "自定义眼型" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "清除 眼型" }));
    expect(screen.queryByRole("button", { name: "自定义眼型" })).not.toBeInTheDocument();
    enterCategory("表情动作");
    expect(screen.getByRole("button", { name: "微笑" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "微笑" }));
    expect(screen.getByRole("button", { name: "微笑" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "平静" })).toHaveAttribute("aria-pressed", "true");
  });

  it("服装下的造型入口也能用可视化卡片选择发型", () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("tab", { name: "造型" }));
    fireEvent.click(screen.getByRole("button", { name: "马尾" }));
    expect(screen.getByRole("button", { name: "马尾" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([
    ["脸部五官", "睫毛", "纤长", "eyelashes"],
    ["发型", "发质", "蓬松", "hair-texture"],
    ["发型", "发尾", "微卷", "hair-ends"],
    ["身材体态", "肩颈", "宽肩", "shoulders"],
    ["表情动作", "视线方向", "侧看", "gaze"],
    ["妆容配饰", "眼妆", "烟熏", "eye-makeup"],
    ["妆容配饰", "妆容风格", "舞台", "makeup"],
    ["脸部五官", "骨相", "立体", "bone-structure"],
    ["脸部五官", "下颌线", "窄下颌", "jawline"],
    ["脸部五官", "颧骨", "明显", "cheekbones"],
    ["脸部五官", "眼神", "清澈", "eye-expression"],
    ["发型", "头发状态", "湿发", "hair-condition"],
    ["身材体态", "腿型", "健壮", "legs"],
    ["肤色皮肤", "皮肤状态", "哑光", "skin-finish"],
  ])("%s 的 %s 图示选项可选且映射正确的素材", (category, field, choice, file) => {
    render(<Workspace />);
    enterCategory(category);
    fireEvent.click(screen.getByRole("button", { name: field }));
    const button = screen.getByRole("button", { name: choice });
    expect(button.querySelector("[style]")?.getAttribute("style")).toContain(`%2Fcharacter-visuals%2F${file}.png`);
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it.each([
    ["身材体态", "体态", "挺拔", "1024 / 2211"],
    ["身材体态", "体态", "自然站姿", "1024 / 2397"],
    ["表情动作", "姿势", "自然站姿", "1024 / 2079"],
    ["表情动作", "姿势", "坐姿", "1024 / 2529"],
    ["身材体态", "腿型", "匀称", "1223 / 1860"],
    ["身材体态", "腿型", "自然", "1223 / 1998"],
  ])("%s 的 %s 示例保持原图的单格比例", (category, field, choice, ratio) => {
    render(<Workspace />);
    enterCategory(category);
    fireEvent.click(screen.getByRole("button", { name: field }));
    expect((screen.getByRole("button", { name: choice }).querySelector("[style]") as HTMLElement).style.aspectRatio).toBe(ratio);
  });

  it("预览服务不可用时提示检查服务配置", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "日常便装" }));
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/预览服务暂不可用/));
  });

  it("上游生成失败时提供可执行的提示并隐藏上游诊断", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "SECRET upstream details" }), { status: 502 })));
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "日常便装" }));
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/检查模型权限/));
    expect(screen.getByRole("alert")).not.toHaveTextContent("SECRET");
  });

  it("生成失败时保留现有角色图并展示错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "日常便装" }));
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/无法生成/));
    expect(screen.getByAltText("角色示例图")).toBeVisible();
  });
});
