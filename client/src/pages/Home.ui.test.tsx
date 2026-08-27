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
      dashboard: { useQuery: () => ({ data: { reviewWords: [], unstartedSets: [] } }) },
      practiceResume: { get: { useQuery: () => ({ data: null, isSuccess: true }) }, save: { useMutation: () => ({ mutateAsync: hooks.mutateAsync }) }, clear: { useMutation: () => ({ mutateAsync: hooks.mutateAsync }) } },
    },
    useUtils: () => ({ learning: { practiceResume: { get: { invalidate: hooks.invalidate } } }, wordbooks: { list: { invalidate: hooks.invalidate }, managed: { invalidate: hooks.invalidate } }, auth: { pinMe: { setData: vi.fn(), invalidate: hooks.invalidate } } }),
    auth: { pinMe: { useQuery: () => ({ data: { profile: { displayName: "学習者の名前" } } }) } },
    profile: { updateName: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) } },
    monster: { dashboard: { useQuery: () => ({ data: { eggs: [] } }) } },
    calendar: { dashboard: { useQuery: () => ({ data: { revivalTickets: 2 } }) } },
    wordbooks: {
      addWord: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      updateWord: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      deleteWord: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      delete: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      previewCsv: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      importCsv: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
      downloadCsv: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
    },
    classroom: {
      calendar: { list: { useQuery: () => ({ data: [] }) }, create: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) }, deletePersonal: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) } },
      announcements: {
        list: { useQuery: () => ({ data: hooks.announcements, isLoading: false, isError: false, refetch: vi.fn() }) },
      },
    },
  },
}));

vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("@/components/LearningTrendChart", () => ({ LearningTrendChart: ({ liveFocusSeconds }: { liveFocusSeconds?: number }) => <div data-testid="live-learning-trend">{liveFocusSeconds}</div> }));
vi.mock("@/components/LearningCalendar", () => ({ LearningCalendar: () => <div>学習カレンダー</div> }));
vi.mock("@/components/MonsterWorkspace", () => ({ MonsterGrowthPanel: () => <div>モンスター育成</div>, MonsterMissionPanel: () => <div>モンスターミッション</div>, MonsterSettingsManager: () => <div>モンスター設定</div> }));

vi.mock("sonner", () => ({
  toast: {
    error: hooks.toastError,
    success: hooks.toastSuccess,
    info: vi.fn(),
  },
}));

import { BookDetail, CardsView, Header, HomeView, ProfileControls, TimerCard, TimerStrip, isLearnerOnlyBook } from "./Home";

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

describe("上部タイマー表示", () => {
  it("作動中は残り時間とONを表示し、停止中はOFFを表示する", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<TimerStrip running elapsed={60} durationMinutes={25} onToggle={onToggle} />);
    expect(screen.getByLabelText("残り時間").textContent).toBe("24:00");
    expect(screen.getByRole("button", { name: "タイマーをオフにする" }).textContent).toBe("ON");
    fireEvent.click(screen.getByRole("button", { name: "タイマーをオフにする" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<TimerStrip running={false} elapsed={60} durationMinutes={25} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "タイマーをオンにする" }).textContent).toBe("OFF");
  });

  it("任意の集中時間と上部表示設定を変更できる", () => {
    const onDurationChange = vi.fn(); const onShowTopTimerChange = vi.fn();
    render(<TimerCard running={false} elapsed={0} durationMinutes={25} showTopTimer onToggle={vi.fn()} onReset={vi.fn()} onDurationChange={onDurationChange} onShowTopTimerChange={onShowTopTimerChange} />);
    expect(screen.queryByLabelText("集中時間（分）")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "タイマー時間：25分" }));
    fireEvent.change(screen.getByLabelText("集中時間（分）"), { target: { value: "50" } });
    expect(onDurationChange).toHaveBeenCalledWith(50);
    expect(screen.queryByLabelText("集中時間（分）")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onShowTopTimerChange).toHaveBeenCalledWith(false);
  });
});

describe("学習プロフィール", () => {
  it("保存済みの表示名をユーザーネームとして視認できるよう表示する", () => {
    render(<ProfileControls />);
    expect(screen.getByText("ユーザーネーム")).toBeTruthy();
    expect(screen.getByTestId("profile-username").textContent).toBe("学習者の名前");
  });
});

describe("集中時間の即時表示", () => {
  const props = { setPage: vi.fn(), onOpenReview: vi.fn(), onPreloadAiSelect: vi.fn(), onResumePractice: vi.fn(), timerDurationMinutes: 25, showTopTimer: true, onToggleTimer: vi.fn(), onResetTimer: vi.fn(), onDurationChange: vi.fn(), onShowTopTimerChange: vi.fn(), summary: { totalFocusSeconds: 0, retention: 0, streak: 0, records: 0 } };
  it("タイマー作動中は、保存前の経過秒数をホーム合計と学習推移へ反映する", () => {
    const { rerender } = render(<HomeView {...props} running elapsed={65} />);
    expect(screen.getByText("1m 5s")).toBeTruthy();
    expect(screen.getByTestId("live-learning-trend").textContent).toBe("65");
    rerender(<HomeView {...props} running elapsed={130} />);
    expect(screen.getByText("2m 10s")).toBeTruthy();
    expect(screen.getByTestId("live-learning-trend").textContent).toBe("130");
  });
});

describe("途中練習の再開導線", () => {
  it("学習の推移の直上に表示し、カード全体を押すと練習を再開する", () => {
    const onResumePractice = vi.fn();
    render(<HomeView setPage={vi.fn()} onOpenReview={vi.fn()} onPreloadAiSelect={vi.fn()} onResumePractice={onResumePractice} practiceResume={{ version: 1, subject: "英単語", words: [{ front: "alpha", back: "最初" }], index: 0, result: { known: 0, review: 0 }, missedWords: [], order: "normal", pool: "normal", savedAt: "2026-08-27T00:00:00.000Z" }} running={false} elapsed={0} timerDurationMinutes={25} showTopTimer onToggleTimer={vi.fn()} onResetTimer={vi.fn()} onDurationChange={vi.fn()} onShowTopTimerChange={vi.fn()} summary={{ totalFocusSeconds: 0, retention: 0, streak: 0, records: 0 }} />);
    const resume = screen.getByTestId("practice-resume-card"); const trend = screen.getByTestId("live-learning-trend");
    expect(resume.compareDocumentPosition(trend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(resume);
    expect(onResumePractice).toHaveBeenCalledTimes(1);
  });
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

describe("教室教材ラベル", () => {
  it("教室公開・全体公開を学習専用として判定し、自分の教材とは区別する", () => {
    expect(isLearnerOnlyBook({ scope: "教室公開" })).toBe(true);
    expect(isLearnerOnlyBook({ scope: "全体公開" })).toBe(true);
    expect(isLearnerOnlyBook({ scope: "自分の教材" })).toBe(false);
  });
});

describe("教室教材の編集制御UI", () => {
  it("管理セッション由来の編集可フラグがあっても、利用者画面では教室教材を編集できない", () => {
    render(<BookDetail book={{ id: "1", remoteId: 1, name: "教室の英単語", count: 1, scope: "教室公開", tone: "from-cyan-400 to-blue-500", canEdit: true, words: [{ id: 11, front: "observe", back: "観察する" }] }} subject="英単語" setBooks={vi.fn()} onPractice={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/管理画面で作成された教室教材/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "単語を編集" })).toBeNull();
    expect(screen.queryByRole("button", { name: "単語を削除" })).toBeNull();
    expect(screen.queryByRole("button", { name: "単語を追加" })).toBeNull();
    expect(screen.getByRole("button", { name: /この単語帳で練習する/ })).toBeTruthy();
  });
});

describe("自作単語帳の削除UI", () => {
  it("自分の教材は詳細画面から削除でき、確認ダイアログを経てAPIを呼び出す", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onClose = vi.fn();
    render(<BookDetail book={{ id: "1", remoteId: 1, name: "自作の英単語", count: 1, scope: "自分の教材", tone: "from-cyan-400 to-blue-500", canEdit: true, words: [{ id: 11, front: "observe", back: "観察する" }] }} subject="英単語" setBooks={vi.fn()} onPractice={vi.fn()} onClose={onClose} />);
    
    const deleteButton = screen.getByRole("button", { name: "単語帳を削除" });
    fireEvent.click(deleteButton);
    
    expect(confirmSpy).toHaveBeenCalledWith("「自作の英単語」を削除しますか？");
    expect(hooks.mutateAsync).toHaveBeenCalledWith({ wordbookId: 1 });
    await waitFor(() => expect(hooks.invalidate).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(hooks.toastSuccess).toHaveBeenCalledWith("単語帳を削除しました。");
    
    confirmSpy.mockRestore();
  });
});
