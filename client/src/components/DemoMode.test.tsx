import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoMode } from "./DemoMode";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });

describe("お試しモード", () => {
  it("固定の英単語帳・漢字単語帳とカードを表示し、管理画面バーを表示しない", () => {
    render(<DemoMode onLogout={vi.fn()} />);
    expect(screen.getAllByText("お試しモード").length).toBeGreaterThan(0);
    expect(screen.queryByText("管理画面")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "単語帳" }));
    expect(screen.getByText("お試し英単語帳")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "漢字" }));
    expect(screen.getByText("お試し漢字単語帳")).toBeTruthy();
    expect(screen.getAllByText("学習専用")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "英単語" }));
    fireEvent.click(screen.getByText("お試し英単語帳"));
    fireEvent.click(screen.getByRole("button", { name: /この単語帳で練習する/ }));
    expect(screen.getByText("右へスワイプで覚えた、左へスワイプで次へ")).toBeTruthy();
  });

  it("カレンダーを利用不可と案内し、保存されないことを表示する", () => {
    render(<DemoMode onLogout={vi.fn()} />);
    expect(screen.getAllByText("お試しモードでは記録しません").length).toBeGreaterThan(0);
    expect(screen.getByText("予定を追加")).toBeTruthy();
  });
});
