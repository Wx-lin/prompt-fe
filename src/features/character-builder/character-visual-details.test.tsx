import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialValues } from "./character-data";
import { CharacterVisualControls } from "./character-visual-controls";

afterEach(cleanup);

describe("角色可视化配置", () => {
  it("国家显示对应国旗和名称，选择时仍写入国家值，虚构世界不显示国旗", () => {
    const onChange = vi.fn();
    render(<CharacterVisualControls category="basic" values={createInitialValues()} en={false} onChange={onChange} previewExpression="" onPreviewExpressionChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "国家／地区" }));
    expect(screen.getByRole("button", { name: "中国" }).querySelector("img")?.getAttribute("src")).toContain("/flags/cn.svg");
    expect(screen.getByRole("button", { name: "日本" }).querySelector("img")?.getAttribute("src")).toContain("/flags/jp.svg");
    expect(screen.getByRole("button", { name: "法国" }).querySelector("img")?.getAttribute("src")).toContain("/flags/fr.svg");
    expect(screen.getByRole("button", { name: "架空世界" }).querySelector("img")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "日本" }));
    expect(onChange).toHaveBeenCalledWith("country", "日本");
  });

  it("地域风格选项显示对应场景，选择仍更新原值", () => {
    const onChange = vi.fn();
    render(<CharacterVisualControls category="basic" values={createInitialValues()} en={false} onChange={onChange} previewExpression="" onPreviewExpressionChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "地域风格" }));
    const modern = screen.getByRole("button", { name: "现代都市" });
    expect(modern.querySelector("[style]")?.getAttribute("style")).toContain("worlds-1.png");
    const coastal = screen.getByRole("button", { name: "海滨小镇" });
    expect(coastal.querySelector("[style]")?.getAttribute("style")).toContain("worlds-2.png");
    fireEvent.click(coastal);
    expect(onChange).toHaveBeenCalledWith("regionalStyle", "海滨小镇");
  });

  it("职业有对应图标，用户自定义职业保留文字", () => {
    render(<CharacterVisualControls category="basic" values={{ ...createInitialValues(), occupation: "原创身份" }} en={false} onChange={() => {}} previewExpression="" onPreviewExpressionChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "职业／身份" }));
    expect(screen.getByRole("button", { name: "医生" }).querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "原创身份" })).toBeInTheDocument();
  });

  it("妆容和肤色冷暖使用相应颜色示意", () => {
    const onChange = vi.fn();
    const { rerender } = render(<CharacterVisualControls category="makeup" values={createInitialValues()} en={false} onChange={onChange} previewExpression="" onPreviewExpressionChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "唇妆" }));
    expect(screen.getByRole("button", { name: "豆沙色" }).querySelector("[style]")).toBeInTheDocument();
    rerender(<CharacterVisualControls key="skin" category="skin" values={createInitialValues()} en={false} onChange={onChange} previewExpression="" onPreviewExpressionChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "肤色冷暖" }));
    expect(screen.getByRole("button", { name: "暖调" }).querySelector("[style]")).toBeInTheDocument();
  });
});
