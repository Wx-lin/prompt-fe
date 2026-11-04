import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialValues } from "./character-data";
import { CharacterWorkbench } from "./character-workbench";

function Workspace({ authenticated = true }: { authenticated?: boolean }) {
  const [values, setValues] = useState(createInitialValues);
  return <CharacterWorkbench values={values} en={false} canUndo={false} authenticated={authenticated} onChange={(id, value) => setValues((previous) => ({ ...previous, [id]: value }))} onApplyOutfit={(changes) => setValues((previous) => ({ ...previous, ...changes }))} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("角色画面生成状态", () => {
  it("未登录点击生成时提示登录且不会发起生成请求", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<Workspace authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("登录后生成角色预览");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("生成期间在画面上展示状态、保留旧图并阻止重复请求；完成后显示新图", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { complete = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    expect(screen.getByRole("status")).toHaveTextContent("正在生成角色");
    expect(screen.getByAltText("角色示例图")).toBeVisible();
    expect(screen.getByRole("button", { name: "生成中，请稍候…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "生成中，请稍候…" }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    complete(new Response(JSON.stringify({ data: { image_base64: "dGVzdA==", mime_type: "image/png" } }), { status: 200 }));
    await waitFor(() => expect(screen.getByAltText("AI 生成的角色预览")).toBeVisible());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认生成" })).toBeEnabled();
  });

  it("生成失败时结束加载态，保留原图并显示可读错误", async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((resolve) => { complete = resolve; })));
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
    expect(screen.getByRole("status")).toBeVisible();
    complete(new Response(null, { status: 503 }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("角色预览服务暂不可用"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByAltText("角色示例图")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认生成" })).toBeEnabled();
  });

  it("手机生成时滚动到角色画面，减少动态效果时不平滑滚动", () => {
    const scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Workspace />);
      fireEvent.click(screen.getByRole("button", { name: "确认生成" }));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    } finally {
      Element.prototype.scrollIntoView = originalScroll;
    }
  });
});
