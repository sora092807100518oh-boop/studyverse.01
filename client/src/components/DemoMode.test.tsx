import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoMode } from "./DemoMode";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("お試しモード", () => {
  it("固定の英単語帳・漢字単語帳とカードを表示し、管理画面バーを表示しない", () => {
    render(<DemoMode onLogout={vi.fn()} />);
    expect(screen.getAllByText("お試しモード").length).toBeGreaterThan(0);
    expect(screen.queryByText("管理画面")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "単語帳" }));
    expect(screen.getByText("お試し英単語帳")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByText("お試し漢字単語帳")).toBeTruthy();
    expect(screen.getAllByText("学習専用")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "単語カード" }));
    fireEvent.click(screen.getByText("お試し英単語帳 基礎セット"));
    fireEvent.click(screen.getByRole("button", { name: "練習" }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    expect(screen.getByText(/右 GREAT \/ PERFECT・左 MISS \/ BAD・下 ESCAPE \/ AVOID・上 THINK \/ DELAY/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /左.*MISS \/ BAD/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /右.*GREAT \/ PERFECT/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /上.*THINK \/ DELAY/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /下.*ESCAPE \/ AVOID/ })).toBeTruthy();
  });

  it("カレンダーを利用不可と案内し、保存されないことを表示する", () => {
    render(<DemoMode onLogout={vi.fn()} />);
    expect(screen.getAllByText("お試しモードでは記録しません").length).toBeGreaterThan(0);
    expect(screen.getByText("予定を追加")).toBeTruthy();
  });

  it("練習カードをスワイプすると画面外へ動いて次のカードへ切り替わる", async () => {
    vi.useFakeTimers();
    render(<DemoMode onLogout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "単語カード" }));
    fireEvent.click(screen.getByText("お試し英単語帳 基礎セット"));
    fireEvent.click(screen.getByRole("button", { name: "練習" }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 90 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 185 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 185 });
    await act(async () => { await vi.advanceTimersByTimeAsync(260); });
    expect(screen.getByText("練習 2 / 10")).toBeTruthy();
    vi.useRealTimers();
  });
});
