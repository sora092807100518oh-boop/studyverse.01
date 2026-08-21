import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  announcements: [] as Array<{ id: number; title: string; body: string; publishedAt: Date }>,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    learning: {
      recordAnswer: {
        useMutation: () => ({ mutateAsync: hooks.mutateAsync }),
      },
    },
    useUtils: () => ({ wordbooks: { list: { invalidate: hooks.invalidate } } }),
    wordbooks: {
      addWord: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      updateWord: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      deleteWord: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
    },
    classroom: {
      announcements: {
        list: { useQuery: () => ({ data: hooks.announcements, isLoading: false, isError: false, refetch: vi.fn() }) },
      },
    },
  },
}));

vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));

vi.mock("sonner", () => ({
  toast: {
    error: hooks.toastError,
    success: hooks.toastSuccess,
    info: vi.fn(),
  },
}));

import { BookDetail, CardsView, Header } from "./Home";

const books = {
  英単語: [{
    id: "english-test",
    name: "英語テスト",
    count: 1,
    scope: "自分の教材",
    tone: "from-cyan-400 to-blue-500",
    words: [{ front: "observe", back: "観察する" }],
  }],
  漢字: [{
    id: "kanji-test",
    name: "漢字テスト",
    count: 1,
    scope: "自分の教材",
    tone: "from-emerald-400 to-teal-500",
    words: [{ front: "継続", back: "けいぞく", reading: "けいぞく" }],
  }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  hooks.mutateAsync.mockReset();
  hooks.toastError.mockReset();
  hooks.toastSuccess.mockReset();
  hooks.invalidate.mockClear();
  hooks.announcements = [];
  window.localStorage.clear();
});

describe("カード回答の記録UI", () => {
  it("保存中は重複操作を防ぎ、成功した回答だけを結果画面へ反映する", async () => {
    const saved = deferred<{ success: true }>();
    hooks.mutateAsync.mockReturnValueOnce(saved.promise);
    render(<CardsView books={books} />);

    fireEvent.click(screen.getByRole("button", { name: /^練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /覚えた/ }));

    expect(screen.getByText("記録を保存しています…")).toBeTruthy();
    expect((screen.getByRole("button", { name: /覚えた/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /覚えた/ }));
    expect(hooks.mutateAsync).toHaveBeenCalledTimes(1);

    saved.resolve({ success: true });
    expect(await screen.findByText("学習を記録しました")).toBeTruthy();
    expect(hooks.toastSuccess).toHaveBeenCalledWith("学習記録を保存しました。");
  });

  it("英単語テストの保存失敗時は同じ問題に留まり、もう一度回答できる", async () => {
    hooks.mutateAsync.mockRejectedValueOnce(new Error("記録サーバーに接続できません"));
    render(<CardsView books={books} />);

    fireEvent.click(screen.getByRole("button", { name: /^テスト/ }));
    fireEvent.change(screen.getByPlaceholderText("回答を入力"), { target: { value: "観察する" } });
    fireEvent.click(screen.getByRole("button", { name: "答えを確認する" }));

    await waitFor(() => expect(hooks.toastError).toHaveBeenCalledWith("記録サーバーに接続できません"));
    expect(screen.getByText("test · 1 / 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: "答えを確認する" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("学習を記録しました")).toBeNull();
  });

  it("漢字テストの保存失敗時も正解確認画面を維持して再試行できる", async () => {
    hooks.mutateAsync.mockRejectedValueOnce(new Error("保存に失敗しました"));
    render(<CardsView books={books} />);

    fireEvent.click(screen.getByRole("button", { name: "漢字" }));
    fireEvent.click(screen.getByRole("button", { name: /^テスト/ }));
    fireEvent.click(screen.getByRole("button", { name: "答えを確認する" }));
    fireEvent.click(screen.getByRole("button", { name: "次の問題" }));

    await waitFor(() => expect(hooks.toastError).toHaveBeenCalledWith("保存に失敗しました"));
    expect(screen.getByText("正解の漢字")).toBeTruthy();
    expect((screen.getByRole("button", { name: "次の問題" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("学習を記録しました")).toBeNull();
  });
});

describe("ホーム通知UI", () => {
  it("新着お知らせがある通知マークを光らせ、タップで一覧を開いて既読表示へ切り替える", () => {
    hooks.announcements = [{ id: 1, title: "学習ミッション", body: "今週の目標を確認しましょう。", publishedAt: new Date("2026-08-21T09:00:00Z") }];
    render(<Header page="ホーム" onBack={vi.fn()} onProfile={vi.fn()} />);
    const notice = screen.getByRole("button", { name: "お知らせを開く" });
    expect(notice.className).toContain("shadow-[0_0_18px");
    fireEvent.click(notice);
    expect(screen.getByRole("heading", { name: "お知らせ" })).toBeTruthy();
    expect(screen.getByText("学習ミッション")).toBeTruthy();
    expect(screen.getByText("今週の目標を確認しましょう。")).toBeTruthy();
    expect(notice.className).not.toContain("shadow-[0_0_18px");
  });
});

describe("教室教材の編集制御UI", () => {
  it("利用者が教室教材を開くと編集不可の理由を表示し、編集操作を出さない", () => {
    render(<BookDetail book={{ id: "1", remoteId: 1, name: "教室の英単語", count: 1, scope: "教室公開", tone: "from-cyan-400 to-blue-500", canEdit: false, words: [{ id: 11, front: "observe", back: "観察する" }] }} subject="英単語" setBooks={vi.fn()} onPractice={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/管理画面で作成された教室教材/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "単語を編集" })).toBeNull();
    expect(screen.queryByRole("button", { name: "単語を削除" })).toBeNull();
    expect(screen.queryByRole("button", { name: "単語を追加" })).toBeNull();
    expect(screen.getByRole("button", { name: /この単語帳で練習する/ })).toBeTruthy();
  });
});
