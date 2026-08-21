import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
      list: { useQuery: () => ({ data: [{ id: 1, label: "英語第1章 第1〜2語", subject: "english", words: [{ id: 101, front: "alpha", back: "最初", reading: null }] }] }) },
      create: { useMutation: () => ({ mutateAsync: hooks.create }) },
      delete: { useMutation: () => ({ mutateAsync: hooks.remove }) },
    },
    classroom: { recommendedTests: { list: { useQuery: () => ({ data: [{ id: 5, wordbookTitle: "配信教材", subject: "english", rangeStart: 2, rangeEnd: 2, questionCount: 1, words: [{ id: 202, front: "gamma", back: "三番目", reading: null }] }] }) } } },
    learning: { review: { useQuery: () => ({ data: [], refetch: hooks.reviewRefetch }) }, recordAnswer: { useMutation: () => ({ mutateAsync: hooks.recordAnswer }) } },
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
    fireEvent.click(screen.getByText("英語第1章 第1〜2語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    expect(screen.getByText("alpha")).toBeTruthy();
  });
  it("先生配信テストを開始できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText(/配信教材/));
    expect(screen.getByText("gamma")).toBeTruthy();
  });
});
