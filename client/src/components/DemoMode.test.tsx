import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoMode } from "./DemoMode";

describe("お試しモード", () => {
  it("固定の英単語帳・漢字単語帳とカードを表示し、管理画面バーを表示しない", () => {
    render(<DemoMode onLogout={vi.fn()} />);
    expect(screen.getByText("お試しモード")).toBeTruthy();
    expect(screen.queryByText("管理画面")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "単語帳" }));
    expect(screen.getByText("お試し英単語帳")).toBeTruthy();
    expect(screen.getByText("お試し漢字単語帳")).toBeTruthy();
    expect(screen.getAllByText("学習専用")).toHaveLength(2);
    fireEvent.click(screen.getByText("お試し英単語帳"));
    expect(screen.getByText("お試しカード")).toBeTruthy();
    expect(screen.getByText("カードをタップして裏返す")).toBeTruthy();
  });

  it("カレンダーを利用不可と案内し、保存されないことを表示する", () => {
    render(<DemoMode onLogout={vi.fn()} />);
    expect(screen.getByText(/カレンダーを利用できません/)).toBeTruthy();
    expect(screen.getByText(/学習記録は保存されません/)).toBeTruthy();
  });
});
