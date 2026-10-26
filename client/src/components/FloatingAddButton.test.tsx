import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingAddButton } from "./FloatingAddButton";

afterEach(cleanup);

describe("スマホの追加ボタン", () => {
  it("短い変形コンテナの内側で描画してもボタンをbody直下へ移す", () => {
    const onClick = vi.fn();
    const { container } = render(<main style={{ transform: "translateY(0)", height: 120, overflow: "hidden" }}><FloatingAddButton label="単語帳を追加" onClick={onClick}/></main>);
    const button = screen.getByRole("button", { name: "単語帳を追加" });
    expect(button.parentElement).toBe(document.body);
    expect(container.contains(button)).toBe(false);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("管理者による追加制限を維持し、画面を離れたらボタンを取り除く", () => {
    const onClick = vi.fn();
    const { unmount } = render(<FloatingAddButton label="単語帳を追加" onClick={onClick} disabled/>);
    const button = screen.getByRole("button", { name: "単語帳を追加" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    unmount();
    expect(screen.queryByRole("button", { name: "単語帳を追加" })).toBeNull();
  });
});
