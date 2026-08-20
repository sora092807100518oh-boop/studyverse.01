import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    learning: {
      recordAnswer: {
        useMutation: () => ({ mutateAsync: hooks.mutateAsync }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: hooks.toastError,
    success: hooks.toastSuccess,
    info: vi.fn(),
  },
}));

import { CardsView } from "./Home";

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
