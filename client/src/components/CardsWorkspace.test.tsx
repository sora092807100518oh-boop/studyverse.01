import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ recordAnswer: vi.fn().mockResolvedValue({ success: true }), reviewRefetch: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    wordbooks: { list: { useQuery: () => ({ data: [{ id: 10, title: "英語第1章", words: [{ id: 101, front: "alpha", back: "最初", reading: null }, { id: 102, front: "beta", back: "次", reading: null }] }], isLoading: false }) } },
    classroom: { recommendedTests: { list: { useQuery: () => ({ data: [{ id: 5, wordbookTitle: "配信教材", subject: "english", rangeStart: 2, rangeEnd: 2, questionCount: 1, words: [{ id: 202, front: "gamma", back: "三番目", reading: null }] }], isLoading: false }) } } },
    learning: { review: { useQuery: () => ({ data: [], refetch: hooks.reviewRefetch }) }, recordAnswer: { useMutation: () => ({ mutateAsync: hooks.recordAnswer }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { CardsWorkspace } from "./CardsWorkspace";

const books = { 英単語: [{ id: "local", name: "ローカル教材", words: [{ front: "local", back: "ローカル" }] }], 漢字: [] };

afterEach(() => { cleanup(); hooks.recordAnswer.mockClear(); hooks.reviewRefetch.mockClear(); });

describe("単語帳連携カード画面", () => {
  it("単語帳と範囲を選択して、その範囲の練習を開始できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.change(screen.getByLabelText("単語帳"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("開始番号"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("終了番号"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    expect(screen.getByText("beta")).toBeTruthy();
    expect(screen.getByText(/practice · 1 \/ 1/)).toBeTruthy();
  });

  it("先生が配信した単語帳の指定範囲だけをテストとして表示する", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByRole("button", { name: "このテストを始める" }));
    expect(screen.getByText("gamma")).toBeTruthy();
    expect(screen.getByText(/test · 1 \/ 1/)).toBeTruthy();
  });

  it("途中終了時にも復習候補を再取得する", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByRole("button", { name: "このテストを始める" }));
    fireEvent.click(screen.getByRole("button", { name: "終了する" }));
    expect(hooks.reviewRefetch).toHaveBeenCalledTimes(1);
  });
});
