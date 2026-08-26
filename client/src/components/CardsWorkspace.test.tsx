import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: 1 }),
  remove: vi.fn().mockResolvedValue({ success: true }),
  invalidate: vi.fn().mockResolvedValue(undefined),
  recordAnswer: vi.fn().mockResolvedValue({ success: true }),
  reviewRefetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ studySets: { list: { invalidate: hooks.invalidate } }, wordbooks: { list: { invalidate: hooks.invalidate } } }),
    wordbooks: { list: { useQuery: () => ({ data: [{ id: 10, title: "英語第1章", words: [{ id: 101, front: "alpha", back: "最初", reading: null }, { id: 102, front: "beta", back: "次", reading: null }] }] }) } },
    studySets: {
      list: { useQuery: () => ({ data: [{ id: 1, label: "英語第1章 第1〜20語", subject: "english", words: Array.from({ length: 20 }, (_, index) => ({ id: 101 + index, front: index === 0 ? "alpha" : `word-${index + 1}`, back: index === 0 ? "最初" : `意味${index + 1}`, reading: null })) }] }) },
      create: { useMutation: () => ({ mutateAsync: hooks.create }) },
      delete: { useMutation: () => ({ mutateAsync: hooks.remove }) },
    },
    classroom: { recommendedTests: { list: { useQuery: () => ({ data: [{ id: 5, wordbookTitle: "配信教材", subject: "english", rangeStart: 2, rangeEnd: 2, questionCount: 1, words: [{ id: 202, front: "gamma", back: "三番目", reading: null }] }] }) } } },
    learning: { review: { useQuery: () => ({ data: [], refetch: hooks.reviewRefetch }) }, dashboard: { useQuery: () => ({ data: { mistakeCounts: [] }, refetch: hooks.reviewRefetch }) }, recordAnswer: { useMutation: () => ({ mutateAsync: hooks.recordAnswer }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { CardsWorkspace } from "./CardsWorkspace";

const books = { 英単語: [{ id: "local", name: "ローカル教材", words: [{ front: "local", back: "ローカル" }] }], 漢字: [] };

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("保存学習セット方式の単語カード", () => {
  it("単語帳の範囲を学習セットとして保存できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /保存する/ }));
    expect(hooks.create).toHaveBeenCalledWith(expect.objectContaining({ wordbookId: 10, rangeStart: 1, rangeEnd: 2 }));
  });
  it("保存済みセットをタップすると練習を開始できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    expect(screen.getByText("練習の設定")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    expect(screen.getByText("最初")).toBeTruthy();
  });
  it("先生配信テストを開始できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText(/配信教材/));
    expect(screen.getByText("テストの設定")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /この設定でテストを始める/ }));
    expect(screen.getByText("三番目")).toBeTruthy();
  });
  it("スマホのポインター移動でカードを左右へスワイプできる", () => {
    vi.useFakeTimers();
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 220 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 220 });
    act(() => { vi.advanceTimersByTime(260); });
    expect(screen.getByText("意味2")).toBeTruthy();
    vi.useRealTimers();
  });
  it("ポインターが取り消されても、移動済みのカードは次のカードへ進む", () => {
    vi.useFakeTimers();
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 180 });
    fireEvent.pointerCancel(card, { pointerId: 1 });
    act(() => { vi.advanceTimersByTime(260); });
    expect(screen.getByText("意味2")).toBeTruthy();
    vi.useRealTimers();
  });
  it("テストでは出題数に応じた制限時間を表示し、時間切れ後に未回答から再開できる", () => {
    vi.useFakeTimers();
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /テスト/ }));
    expect(screen.getByLabelText("出題数")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("出題数"), { target: { value: "20" } });
    expect(screen.getByText("10分")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /この設定でテストを始める/ }));
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(screen.getByText("制限時間になりました")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "続きをもう一度解く" }));
    expect(screen.getByText(/テスト 1 \/ 20/)).toBeTruthy();
    vi.useRealTimers();
  });
  it("結果画面に誤答一覧を表示し、誤答だけを再テストできる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText(/配信教材/));
    fireEvent.click(screen.getByRole("button", { name: /この設定でテストを始める/ }));
    fireEvent.change(screen.getByPlaceholderText("答えを入力"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "答えを確認する" }));
    fireEvent.click(screen.getByRole("button", { name: "復習に入れる" }));
    expect(screen.getByText("誤答一覧（1問）")).toBeTruthy();
    expect(screen.getByText("答え：gamma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "誤答だけをもう一度テストする" }));
    expect(screen.getByText(/テスト 1 \/ 1/)).toBeTruthy();
  });
});
