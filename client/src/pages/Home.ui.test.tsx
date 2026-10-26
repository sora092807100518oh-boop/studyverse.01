import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  announcements: [] as Array<{ id: number; title: string; body: string; publishedAt: Date }>,
  sendTestResult: { sent: 1 } as { sent: number; skipped?: string },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    learning: {
      recordAnswer: {
        useMutation: () => ({ mutateAsync: hooks.mutateAsync }),
      },
      dashboard: { useQuery: () => ({ data: { reviewWords: [], unstartedSets: [] } }) },
    },
    useUtils: () => ({ wordbooks: { list: { invalidate: hooks.invalidate }, managed: { invalidate: hooks.invalidate } }, auth: { pinMe: { setData: vi.fn(), invalidate: hooks.invalidate } }, classroom: { online: { list: { invalidate: hooks.invalidate } }, recommendedTests: { announcements: { invalidate: hooks.invalidate }, list: { invalidate: hooks.invalidate } } }, market: { wallet: { invalidate: hooks.invalidate } } }),
    auth: { pinMe: { useQuery: () => ({ data: { profile: { displayName: "学習者の名前", avatarUrl: "/manus-storage/profile-test.png" } } }) } },
    profile: { updateName: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) }, uploadAvatar: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ avatarUrl: "/manus-storage/profile-test.png" }), isPending: false }) } },
    monster: { dashboard: { useQuery: () => ({ data: { eggs: [] } }) } },
    market: { wallet: { useQuery: () => ({ data: { balance: 200 }, isLoading: false }) } },
    calendar: { dashboard: { useQuery: () => ({ data: { revivalTickets: 2 } }) } },
    smartNotifications: {
      settings: { useQuery: () => ({ data: { wordbookId: 1, direction: "question" as const, enabled: true, startTime: "08:00", endTime: "21:00" } }) },
      publicKey: { useQuery: () => ({ data: { publicKey: "test-public-key" } }) },
      subscribe: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ success: true }), isPending: false }) },
      save: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ success: true }), isPending: false }) },
      sendTest: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue(hooks.sendTestResult), isPending: false }) },
    },
    wordbooks: {
      list: { useQuery: () => ({ data: [{ id: 1, title: "英語テスト", subject: "english" }], isLoading: false }) },
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
      online: { list: { useQuery: () => ({ data: { classroom: { id: 1, name: "テスト教室" }, members: [] }, isLoading: false, isError: false, refetch: vi.fn() }) }, ping: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ online: true }) }) } },
      announcements: {
        list: { useQuery: () => ({ data: hooks.announcements, isLoading: false, isError: false, refetch: vi.fn() }) },
      },
      recommendedTests: {
        announcements: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) },
        claim: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
        claimWordbook: { useMutation: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }) },
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

import { BookDetail, CardsView, DEFAULT_HOME_LAYOUT, Header, HOME_LAYOUT_STORAGE_KEY, HomeView, LoginGate, moveHomeLayoutItem, normalizeHomeLayout, ProfileControls, TimerCard, TimerStrip, isLearnerOnlyBook } from "./Home";

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
  hooks.sendTestResult = { sent: 1 };
  window.localStorage.clear();
});

describe("OAuthログイン画面", () => {
  const gateProps = {
    oauthUser: null,
    onEnter: vi.fn().mockResolvedValue(undefined),
    onPersonalEnter: vi.fn().mockResolvedValue(undefined),
    onOAuthLogin: vi.fn(),
    onAdminEnter: vi.fn(),
    onTeacherEnter: vi.fn(),
  };

  it("学校IDを先に入力し、専用認証画面へ進む共通ボタンに引き継ぐ", () => {
    render(<LoginGate {...gateProps} />);
    expect(screen.getByText("① school id")).toBeTruthy();
    expect(screen.getByText("学校IDを入力")).toBeTruthy();
    expect(screen.getByText("学校IDがなければ、空欄のまま個人利用として進められます。")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("例：STAR-2026"), { target: { value: "school-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Google／Appleでログイン" }));
    expect(gateProps.onOAuthLogin).toHaveBeenCalledWith({ schoolId: "SCHOOL-2026" });
    expect(screen.getByText(/次のStudyVerse専用認証画面/)).toBeTruthy();
  });

  it("OAuth後は学校IDがあれば学校へ、空欄なら個人利用へ進める", async () => {
    const onEnter = vi.fn().mockResolvedValue(undefined);
    const onPersonalEnter = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<LoginGate {...gateProps} onEnter={onEnter} onPersonalEnter={onPersonalEnter} oauthUser={{ name: "テスト利用者" }} />);
    fireEvent.change(screen.getByPlaceholderText("例：STAR-2026"), { target: { value: "STAR-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "学校IDでログイン" }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("STAR-2026"));
    fireEvent.change(screen.getByPlaceholderText("例：STAR-2026"), { target: { value: "" } });
    rerender(<LoginGate {...gateProps} onEnter={onEnter} onPersonalEnter={onPersonalEnter} oauthUser={{ name: "テスト利用者" }} />);
    fireEvent.click(screen.getByRole("button", { name: "個人利用でログイン" }));
    await waitFor(() => expect(onPersonalEnter).toHaveBeenCalledTimes(1));
  });

  it("必要な入力とログイン操作を一つのフォーム内に表示する", () => {
    render(<LoginGate {...gateProps} />);
    expect(screen.getByTestId("login-form")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google／Appleでログイン" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "学校IDを読み取る" })).toBeTruthy();
  });
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
    expect(screen.getByLabelText("集中時間（分）")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("集中時間（分）"), { target: { value: "50" } });
    expect(onDurationChange).toHaveBeenCalledWith(50);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onShowTopTimerChange).toHaveBeenCalledWith(false);
  });
});

describe("学習プロフィール", () => {
  it("保存済みの表示名をユーザーネームとして視認できるよう表示する", () => {
    render(<ProfileControls />);
    expect(screen.getByText("ユーザーネーム")).toBeTruthy();
    expect(screen.getByTestId("profile-username").textContent).toBe("学習者の名前");
    expect(screen.getByLabelText("プロフィール画像を変更")).toBeTruthy();
    expect(screen.getByAltText("プロフィール画像").getAttribute("src")).toBe("/manus-storage/profile-test.png");
  });

  it("表示名保存時に親画面の保持コールバックへ最新値を渡す", async () => {
    const onDisplayNameSaved = vi.fn();
    hooks.mutateAsync.mockResolvedValueOnce({ displayName: "新しい表示名" });
    render(<ProfileControls currentDisplayName="古い表示名" onDisplayNameSaved={onDisplayNameSaved} />);
    fireEvent.change(screen.getByPlaceholderText("表示名"), { target: { value: "新しい表示名" } });
    fireEvent.click(screen.getByRole("button", { name: "名前を保存" }));
    await waitFor(() => expect(onDisplayNameSaved).toHaveBeenCalledWith("新しい表示名"));
    expect(screen.getByTestId("profile-username").textContent).toBe("新しい表示名");
  });

  it("通知時間帯を表示し、今すぐ通知ボタンでテスト送信できる", async () => {
    render(<ProfileControls showSmartNotifications />);
    expect((screen.getByLabelText("スマート通知の開始時刻") as HTMLInputElement).value).toBe("08:00");
    expect((screen.getByLabelText("スマート通知の終了時刻") as HTMLInputElement).value).toBe("21:00");
    fireEvent.click(screen.getByRole("button", { name: "今すぐ通知を送る" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "今すぐ通知を送る" })).toBeTruthy());
  });
  it("配送失敗時は通知許可の確認と再試行を案内する", async () => {
    hooks.sendTestResult = { sent: 0, skipped: "delivery_failed" };
    render(<ProfileControls showSmartNotifications />);
    fireEvent.click(screen.getByRole("button", { name: "今すぐ通知を送る" }));
    await waitFor(() => expect(hooks.toastError).toHaveBeenCalledWith("通知サービスが端末へ届けられませんでした。通知許可を確認してから再試行してください。"));
  });
});

describe("集中時間の即時表示", () => {
  const props = { setPage: vi.fn(), onOpenReview: vi.fn(), onPreloadAiSelect: vi.fn(), timerDurationMinutes: 25, showTopTimer: true, onToggleTimer: vi.fn(), onResetTimer: vi.fn(), onDurationChange: vi.fn(), onShowTopTimerChange: vi.fn(), summary: { totalFocusSeconds: 0, retention: 0, streak: 0, records: 0 } };
  it("あいさつ・誘導文を表示せず、学習状況とメニューの後にタイマーを置く", () => {
    const { container } = render(<HomeView {...props} displayName="テスト" running={false} elapsed={0}/>);
    expect(screen.queryByText(/こんにちは|えらぼう|選ぼう|小さな一歩/)).toBeNull();
    expect(container.querySelector(".home-reorder-grid")).toBeTruthy();
    expect(Array.from(container.querySelectorAll("[data-home-item]")).map(node => node.getAttribute("data-home-item"))).toEqual(["focus", "accuracy", "streak", "ai", "review", "calendar", "trend", "growth", "mission", "timer", "online"]);
    expect(screen.getByRole("button", { name: "予定を開く" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "育成を開く" })).toBeTruthy();
  });
  it("ホーム上で時間を直接選択し、別画面を開かず自由な時間も設定できる", () => {
    const onDurationChange = vi.fn();
    render(<HomeView {...props} onDurationChange={onDurationChange} running={false} elapsed={0}/>);
    fireEvent.change(screen.getByLabelText("集中時間（分）"), { target: { value: "50" } });
    expect(onDurationChange).toHaveBeenCalledWith(50);
    fireEvent.change(screen.getByLabelText("集中時間（分）"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("カスタム時間（分）"), { target: { value: "37" } });
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(onDurationChange).toHaveBeenCalledWith(37);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("タイマー設定をページの外側へ表示し、開始・リセット・表示切替を操作できる", () => {
    const onDurationChange = vi.fn(); const onResetTimer = vi.fn(); const onShowTopTimerChange = vi.fn();
    const { container } = render(<HomeView {...props} onDurationChange={onDurationChange} onResetTimer={onResetTimer} onShowTopTimerChange={onShowTopTimerChange} running={false} elapsed={0}/>);
    fireEvent.click(screen.getByRole("button", { name: "タイマーを設定" }));
    const dialog = screen.getByRole("dialog", { name: "タイマー設定" });
    expect(dialog.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);
    fireEvent.change(within(dialog).getByLabelText("集中時間（分）"), { target: { value: "15" } });
    expect(onDurationChange).toHaveBeenCalledWith(15);
    fireEvent.click(within(dialog).getByRole("button", { name: "リセット" }));
    expect(onResetTimer).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(onShowTopTimerChange).toHaveBeenCalledWith(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("作動中の時間変更を無効にし、個人利用のオンライン導線を表示しない", () => {
    render(<HomeView {...props} isPersonalUse running elapsed={65}/>);
    expect((screen.getByLabelText("集中時間（分）") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByLabelText("ホームの残り時間").textContent).toBe("23:55");
    expect(screen.queryByRole("button", { name: "オンライン状況を開く" })).toBeNull();
  });
  it("タイマー作動中は、保存前の経過秒数をホーム合計と学習推移へ反映する", () => {
    const { rerender } = render(<HomeView {...props} running elapsed={65} />);
    expect(screen.getByText("1m 5s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "推移を開く" }));
    expect(screen.getByTestId("live-learning-trend").textContent).toBe("65");
    rerender(<HomeView {...props} running elapsed={130} />);
    expect(screen.getByText("2m 10s")).toBeTruthy();
    expect(screen.getByTestId("live-learning-trend").textContent).toBe("130");
  });
  it("ホーム最下部のオンライン状況ボタンから専用ページへ移動できる", () => {
    const setPage = vi.fn();
    render(<HomeView {...props} setPage={setPage} running={false} elapsed={0} />);
    fireEvent.click(screen.getByRole("button", { name: /オンライン状況/ }));
    expect(setPage).toHaveBeenCalledWith("online");
  });
});

describe("ホームの並び替え", () => {
  const props = { setPage: vi.fn(), onOpenReview: vi.fn(), onPreloadAiSelect: vi.fn(), timerDurationMinutes: 25, showTopTimer: true, onToggleTimer: vi.fn(), onResetTimer: vi.fn(), onDurationChange: vi.fn(), onShowTopTimerChange: vi.fn(), summary: { totalFocusSeconds: 0, retention: 0, streak: 0, records: 0 } };
  afterEach(() => { vi.useRealTimers(); window.localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY); });
  it("壊れた保存データを無視し、既存順を保ちながら新しい項目を補う", () => {
    expect(normalizeHomeLayout(["timer", "ai", "timer", "unknown"])).toEqual(["timer", "ai", ...DEFAULT_HOME_LAYOUT.filter(id => id !== "timer" && id !== "ai")]);
    expect(normalizeHomeLayout("invalid")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout(["online", "timer"], true)).toEqual(["timer", ...DEFAULT_HOME_LAYOUT.filter(id => id !== "timer" && id !== "online")]);
  });
  it("タイルを入れ替える純粋処理は移動元と移動先を入れ替える", () => {
    expect(moveHomeLayoutItem(["ai", "timer", "focus"], "timer", "ai")).toEqual(["timer", "ai", "focus"]);
    expect(moveHomeLayoutItem(["ai", "timer"], "missing" as never, "ai")).toEqual(["ai", "timer"]);
  });
  it("長押しで編集状態へ入り、完了と元に戻すを操作できる", () => {
    vi.useFakeTimers();
    const { container } = render(<HomeView {...props} running={false} elapsed={0}/>);
    const ai = container.querySelector<HTMLElement>('[data-home-item="ai"]')!;
    fireEvent.pointerDown(ai, { pointerId: 7, pointerType: "touch", clientX: 32, clientY: 220 });
    act(() => { vi.advanceTimersByTime(430); });
    expect(screen.getByRole("status").textContent).toContain("並び替え中");
    expect(container.querySelector(".home-reorder-grid")?.classList.contains("is-editing")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(Array.from(container.querySelectorAll("[data-home-item]")).map(node => node.getAttribute("data-home-item"))).toEqual(DEFAULT_HOME_LAYOUT);
    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("保存済みの並び順を復元し、個人利用ではオンライン項目を除く", () => {
    window.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, JSON.stringify(["timer", "ai", "focus"]));
    const { container, rerender } = render(<HomeView {...props} running={false} elapsed={0}/>);
    expect(Array.from(container.querySelectorAll("[data-home-item]")).slice(0, 3).map(node => node.getAttribute("data-home-item"))).toEqual(["timer", "ai", "focus"]);
    rerender(<HomeView {...props} isPersonalUse running={false} elapsed={0}/>);
    expect(container.querySelector('[data-home-item="online"]')).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
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
    expect(screen.getByLabelText("マーケットコイン 200")).toBeTruthy();
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
