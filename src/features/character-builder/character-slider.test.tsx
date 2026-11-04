import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSlider } from "./character-slider";

afterEach(cleanup);

describe("CharacterSlider", () => {
  const choices = ["柔和", "精致", "立体", "清晰"];
  function Example({ initial = "立体" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <CharacterSlider label="骨相" value={value} choices={choices} onChange={setValue} />;
  }

  it("provides readable values and updates via arrow keys", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const slider = screen.getByRole("slider", { name: "骨相" });
    expect(slider).toHaveAttribute("aria-valuetext", "立体");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuetext", "清晰");
    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute("aria-valuetext", "柔和");
  });

  it("preserves a custom or unspecified value until the user changes it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CharacterSlider label="骨相" value="自定义骨相" choices={choices} onChange={onChange} />);
    const slider = screen.getByRole("slider", { name: "骨相" });
    expect(slider).toHaveAttribute("aria-valuetext", "自定义骨相");
    expect(onChange).not.toHaveBeenCalled();
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("柔和");
  });
});
