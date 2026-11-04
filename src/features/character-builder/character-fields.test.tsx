import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterFieldControl } from "./character-fields";
import type { CharacterField } from "./character-data";

afterEach(cleanup);

function Field({ field, en = false }: { field: CharacterField; en?: boolean }) {
  const [value, setValue] = useState(field.defaultValue);
  return <><CharacterFieldControl field={field} value={value} en={en} onChange={setValue} /><output aria-label="结果">{value}</output></>;
}

describe("角色配置字段", () => {
  it("展开已有值时显示全部候选，选择后更新并收起", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "gender", label: "性别", enLabel: "Gender", type: "select", defaultValue: "女性", options: ["女性", "男性", "中性"] }} />);
    await user.click(screen.getByRole("button", { name: "展开性别选项" }));
    expect(await screen.findByRole("option", { name: "女性" })).toBeVisible();
    expect(screen.getByRole("option", { name: "男性" })).toBeVisible();
    expect(screen.getByRole("option", { name: "中性" })).toBeVisible();
    await user.click(screen.getByRole("option", { name: "男性" }));
    expect(screen.getByRole("combobox", { name: "性别" })).toHaveValue("男性");
    expect(screen.getByLabelText("结果")).toHaveTextContent("男性");
    expect(screen.queryByRole("option", { name: "女性" })).not.toBeInTheDocument();
  });

  it("输入筛选候选后点击空白取消，不会改写原值", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发", "长卷发", "短发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    expect(await screen.findByRole("option", { name: "长卷发" })).toBeVisible();
    await user.clear(input);
    await user.type(input, "长");
    expect(screen.getByRole("option", { name: "长卷发" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "短发" })).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "自定义造型");
    await user.click(document.body);
    expect(input).toHaveValue("直发");
    expect(screen.getByLabelText("结果")).toHaveTextContent("直发");
    await user.click(screen.getByRole("button", { name: "展开发型选项" }));
    expect(await screen.findByRole("option", { name: "短发" })).toBeVisible();
  });

  it("支持用键盘筛选并选择候选值", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发", "短发", "短卷发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "短");
    expect(await screen.findByRole("option", { name: "短发" })).toBeVisible();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("短卷发");
    expect(screen.getByLabelText("结果")).toHaveTextContent("短卷发");
  });

  it("键盘聚焦后直接输入能立即筛选候选", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发", "短发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    input.focus();
    await user.keyboard("{Control>}a{/Control}短");
    expect(await screen.findByRole("option", { name: "短发" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "长发" })).not.toBeInTheDocument();
  });
  it("首次点击已有值后输入即替换，再次点击可精确编辑", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "role", label: "职业", enLabel: "Occupation", type: "select", defaultValue: "演员", options: ["演员", "摄影师", "设计师"] }} />);
    const input = screen.getByRole("combobox", { name: "职业" }) as HTMLInputElement;
    await user.click(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(2);
    await user.keyboard("摄影");
    expect(input).toHaveValue("摄影");
    expect(screen.getByRole("option", { name: "摄影师" })).toBeVisible();
    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.keyboard("像");
    expect(input).toHaveValue("摄像影");
  });

  it("编辑时不改变已保存值，按 Escape 放弃修改", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发", "短发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "长");
    expect(screen.getByLabelText("结果")).toHaveTextContent("直发");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("直发");
    expect(screen.getByLabelText("结果")).toHaveTextContent("直发");
  });

  it("点击候选时只提交完整值，不提交筛选词", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<CharacterFieldControl field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长卷发"] }} value="直发" en={false} onChange={changed} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "长");
    await user.click(await screen.findByRole("option", { name: "长卷发" }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith("长卷发");
  });

  it("输入无匹配自定义值后可用 Enter 确认", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "定制编发{Enter}");
    expect(screen.getByLabelText("结果")).toHaveTextContent("定制编发");
    expect(input).toHaveValue("定制编发");
  });
  it("输入无匹配的自定义值后按 Tab 可提交并移动焦点", async () => {
    const user = userEvent.setup();
    render(<><Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发"] }} /><button>下一项</button></>);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "定制编发");
    await user.tab();
    expect(screen.getByLabelText("结果")).toHaveTextContent("定制编发");
    expect(input).toHaveValue("定制编发");
    expect(screen.getByRole("button", { name: "下一项" })).toHaveFocus();
  });
  it("输入匹配候选的搜索词后按 Tab 取消而不保存半截词", async () => {
    const user = userEvent.setup();
    render(<><Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长发"] }} /><button>下一项</button></>);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "长");
    await user.tab();
    expect(input).toHaveValue("直发");
    expect(screen.getByLabelText("结果")).toHaveTextContent("直发");
    expect(screen.getByRole("button", { name: "下一项" })).toHaveFocus();
  });

  it("输入匹配候选后按 Enter 选中第一项", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长卷发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "长{Enter}");
    expect(screen.getByLabelText("结果")).toHaveTextContent("长卷发");
  });
  it("有匹配候选时可用 Ctrl+Enter 明确保存自定义文字", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长卷发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "长");
    expect(screen.getByText(/Ctrl\/⌘/)).toBeVisible();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^长$/);
  });
  it("有匹配候选时可点击使用自定义内容", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长卷发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "长");
    await user.click(screen.getByRole("option", { name: "使用输入内容：长" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^长$/);
  });
  it("清空选择框后回车可明确清空已选值", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "hair", label: "发型", enLabel: "Hair", type: "select", defaultValue: "直发", options: ["直发", "长卷发"] }} />);
    const input = screen.getByRole("combobox", { name: "发型" });
    await user.click(input);
    await user.clear(input);
    expect(screen.getByText("按回车清空此项")).toBeVisible();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("结果")).toBeEmptyDOMElement();
  });
  it("可输入自定义内容并明确按 Enter 确认", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "gender", label: "性别", enLabel: "Gender", type: "select", defaultValue: "女性", options: ["女性", "男性"] }} />);
    const input = screen.getByRole("combobox", { name: "性别" });
    await user.clear(input);
    await user.type(input, "男性");
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("结果")).toHaveTextContent("男性");
    await user.clear(input);
    await user.type(input, "自定义角色");
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("结果")).toHaveTextContent("自定义角色");
  });

  it("多选无与已有或自定义标记互斥，包括旧的矛盾值", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "marks", label: "标记", enLabel: "Marks", type: "tags", defaultValue: "眼角痣", options: ["无", "眼角痣", "雀斑"] }} />);
    await user.click(screen.getByRole("button", { name: "无" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^无$/);
    expect(screen.getByRole("button", { name: "眼角痣" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "雀斑" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^雀斑$/);
    await user.click(screen.getByRole("button", { name: "无" }));
    await user.type(screen.getByLabelText("标记 自定义"), "细疤");
    await user.click(screen.getByRole("button", { name: "添加" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^细疤$/);
  });

  it("默认不指定显示为空和占位提示，输入内容不携带占位词", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "description", label: "说明", enLabel: "Description", type: "textarea", defaultValue: "不指定" }} />);
    const input = screen.getByRole("textbox", { name: "说明" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "不指定");
    await user.type(input, "戴眼镜");
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^戴眼镜$/);
  });
  it("旧的矛盾多选值保留到用户操作时再消除冲突", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "marks", label: "标记", enLabel: "Marks", type: "tags", defaultValue: "无，眼角痣，雀斑", options: ["无", "眼角痣", "雀斑"] }} />);
    expect(screen.getByLabelText("结果")).toHaveTextContent("无，眼角痣，雀斑");
    await user.click(screen.getByRole("button", { name: "雀斑" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent(/^眼角痣$/);
  });

  it("多选支持添加自定义内容、取消选中，并限制总长度", () => {
    const enormous = "x".repeat(1990);
    render(<Field field={{ id: "marks", label: "标记", enLabel: "Marks", type: "tags", defaultValue: enormous, options: ["雀斑"] }} />);
    fireEvent.change(screen.getByLabelText("标记 自定义"), { target: { value: "abcdefghijk" } });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(screen.getByRole("alert")).toHaveTextContent("2000");
    expect(screen.getByLabelText("结果")).toHaveTextContent(enormous);
    fireEvent.click(screen.getByRole("button", { name: enormous }));
    fireEvent.click(screen.getByRole("button", { name: "雀斑" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent("雀斑");
    fireEvent.change(screen.getByLabelText("标记 自定义"), { target: { value: "细疤" } });
    fireEvent.keyDown(screen.getByLabelText("标记 自定义"), { key: "Enter" });
    expect(screen.getByLabelText("结果")).toHaveTextContent("雀斑，细疤");
    fireEvent.click(screen.getByRole("button", { name: "雀斑" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent("细疤");
  });

  it("分镜张数拒绝小数与越界，保持上次有效值", () => {
    render(<Field field={{ id: "shotCount", label: "连续分镜张数", enLabel: "Shots", type: "number", defaultValue: "4" }} />);
    const input = screen.getByRole("spinbutton", { name: /连续分镜张数/ });
    fireEvent.change(input, { target: { value: "-3" } });
    expect(screen.getByRole("alert")).toHaveTextContent("无效");
    expect(input).toHaveValue(4);
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(input).toHaveValue(4);
    fireEvent.change(input, { target: { value: "12" } });
    expect(input).toHaveValue(12);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("开关和多行描述可编辑；英文界面展示对应标签", () => {
    const { unmount } = render(<Field field={{ id: "lockFace", label: "锁定脸", enLabel: "Lock face", type: "toggle", defaultValue: "true" }} en />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Lock face" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent("false");
    unmount();
    render(<Field field={{ id: "description", label: "说明", enLabel: "Description", type: "textarea", defaultValue: "" }} en />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "沉着\n果敢" } });
    expect(screen.getByLabelText("结果")).toHaveTextContent("沉着 果敢");
  });

  it("英文候选显示翻译，并保留用户输入的自定义值", async () => {
    const user = userEvent.setup();
    render(<Field field={{ id: "gender", label: "性别", enLabel: "Gender", type: "select", defaultValue: "女性", options: ["女性", "男性"] }} en />);
    const input = screen.getByRole("combobox", { name: "Gender" });
    expect(input).toHaveValue("female");
    await user.clear(input);
    await user.type(input, "custom value");
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("结果")).toHaveTextContent("custom value");
  });

  it("CFG 可输入小数且拒绝过大值，空值也可使用", () => {
    render(<Field field={{ id: "cfg", label: "CFG", enLabel: "CFG", type: "text", defaultValue: "7" }} en />);
    const input = screen.getByRole("spinbutton", { name: /CFG/ });
    fireEvent.change(input, { target: { value: "7.5" } });
    expect(input).toHaveValue(7.5);
    fireEvent.change(input, { target: { value: "31" } });
    expect(screen.getByRole("alert")).toHaveTextContent("valid number");
    expect(input).toHaveValue(7.5);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(null);
  });

  it("英文多选的自定义项可增加和取消", () => {
    render(<Field field={{ id: "personality", label: "性格", enLabel: "Personality", type: "tags", defaultValue: "", options: ["温柔"] }} en />);
    fireEvent.change(screen.getByLabelText("Personality custom"), { target: { value: "curious" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByLabelText("结果")).toHaveTextContent("curious");
    fireEvent.click(screen.getByRole("button", { name: "curious" }));
    expect(screen.getByLabelText("结果")).toBeEmptyDOMElement();
  });
});
