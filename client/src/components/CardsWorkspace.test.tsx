import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: 1 }),
  remove: vi.fn().mockResolvedValue({ success: true }),
  invalidate: vi.fn().mockResolvedValue(undefined),
  recordAnswer: vi.fn().mockResolvedValue({ success: true }),
  saveNote: vi.fn().mockResolvedValue({ wordId: 101, note: "覚え方メモ" }),
  setNotes: vi.fn(),
  reviewRefetch: vi.fn().mockResolvedValue(undefined),
  claimWordbook: vi.fn().mockResolvedValue({ receivedWordbookId: 303, alreadyClaimed: false }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ studySets: { list: { invalidate: hooks.invalidate } }, wordbooks: { list: { invalidate: hooks.invalidate } }, wordNotes: { list: { setData: hooks.setNotes, invalidate: hooks.invalidate } } }),
    wordbooks: { list: { useQuery: (input: { subject?: string }) => ({ data: input.subject === "kanji" ? [{ id: 11, title: "漢字第1章", words: [{ id: 301, front: "学", back: "まなぶ", reading: "まなぶ" }] }] : [{ id: 10, title: "英語第1章", words: [{ id: 101, front: "alpha", back: "最初", reading: null }, { id: 102, front: "beta", back: "次", reading: null }] }] }) } },
    studySets: {
      list: { useQuery: () => ({ data: [{ id: 1, label: "英語第1章 第1〜20語", subject: "english", words: Array.from({ length: 20 }, (_, index) => ({ id: 101 + index, front: index === 0 ? "alpha" : `word-${index + 1}`, back: index === 0 ? "最初" : `意味${index + 1}`, reading: null, exampleSentence: index === 0 ? "I study alpha every day." : null, exampleTranslation: index === 0 ? "私は毎日alphaを勉強します。" : null })) }, { id: 2, label: "漢字第1章", subject: "kanji", words: [{ id: 301, front: "学", back: "まなぶ", reading: "まなぶ" }] }] }) },
      create: { useMutation: () => ({ mutateAsync: hooks.create }) },
      delete: { useMutation: () => ({ mutateAsync: hooks.remove }) },
    },
    classroom: { recommendedTests: { list: { useQuery: () => ({ data: [{ id: 5, wordbookTitle: "配信教材", subject: "english", rangeStart: 2, rangeEnd: 2, questionCount: 1, deliveryType: "test", words: [{ id: 202, front: "gamma", back: "三番目", reading: null }] }] }) }, claimWordbook: { useMutation: () => ({ mutateAsync: hooks.claimWordbook, isPending: false }) } } },
    wordNotes: { list: { useQuery: () => ({ data: [] }) }, save: { useMutation: () => ({ mutateAsync: hooks.saveNote, isPending: false }) } },
    learning: { review: { useQuery: () => ({ data: [], refetch: hooks.reviewRefetch }) }, dashboard: { useQuery: () => ({ data: { mistakeCounts: [], practiceRatings: [{ wordId: 101, rating: "instant" }, { wordId: 102, rating: "slow" }] }, refetch: hooks.reviewRefetch }) }, recordAnswer: { useMutation: () => ({ mutateAsync: hooks.recordAnswer }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { CardsWorkspace } from "./CardsWorkspace";

const books = { 英単語: [{ id: "local", name: "ローカル教材", words: [{ front: "local", back: "ローカル" }] }], 漢字: [] };

afterEach(() => { cleanup(); window.localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

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
  it("例文表示は現在のカード面を置き換え、カードを裏返すと英単語と意味へ戻る", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.click(screen.getByRole("button", { name: "単語詳細を開く" }));
    expect(screen.getByText("単語の詳細")).toBeTruthy();
    expect(screen.getByText("私は毎日alphaを勉強します。")).toBeTruthy();
    expect(screen.getByText("I study alpha every day.")).toBeTruthy();
    expect(screen.getByText("最初")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "例文を見る" })).toBeNull();
  });
  it("歯車の詳細は同じカード内で表示し、暗いダイアログを開かない", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByRole("button", { name: "単語詳細を開く" }));
    expect(screen.getByText("単語の詳細")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("最初")).toBeTruthy();
  });
  it("練習カードの一言メモを保存できる", async () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByRole("button", { name: "一言メモ" }));
    fireEvent.change(screen.getByLabelText("一言メモ"), { target: { value: "覚え方メモ" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(hooks.saveNote).toHaveBeenCalledWith({ wordId: 101, note: "覚え方メモ" }));
  });
  it("特訓モードは初期状態がオフで、過去判定にかかわらず選択範囲の全カードから開始する", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    const trainingSwitch = screen.getByRole("switch", { name: "特訓モード" });
    expect(trainingSwitch.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(trainingSwitch);
    expect(trainingSwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    expect(screen.getByText("最初")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /GREAT \/ PERFECT/ }));
    expect(screen.getByText("意味2")).toBeTruthy();
  });
  it("特訓モードは右判定で最後の未達成カードを完了扱いにする", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /ESCAPE \/ AVOID/ }));
    fireEvent.click(screen.getByRole("button", { name: /練習モード/ }));
    fireEvent.click(screen.getByRole("switch", { name: "特訓モード" }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByRole("button", { name: /GREAT \/ PERFECT/ }));
    expect(screen.getByText("学習を記録しました")).toBeTruthy();
  });
  it("特訓モードで左・下判定を選ぶと同じ未達成カードを再出題する", async () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("switch", { name: "特訓モード" }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByRole("button", { name: /ESCAPE \/ AVOID/ }));
    expect(screen.getByText("意味2")).toBeTruthy();
    expect(screen.queryByText("学習を記録しました")).toBeNull();
    await waitFor(() => expect(hooks.recordAnswer).toHaveBeenCalledWith(expect.objectContaining({ practiceRating: "slow" })));
  });
  it("特訓モードの途中再開データに設定を保存する", async () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("switch", { name: "特訓モード" }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByRole("button", { name: /終了する/ }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("studyverse-practice-continue") ?? "{}").training).toBe(true));
  });
  it("練習設定で問答方向を選ぶと、カードの最初の表示が切り替わる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText(/英語第1章 第1〜20語/));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    expect((screen.getByLabelText("最初に出す方") as HTMLSelectElement).value).toBe("question");
    fireEvent.change(screen.getByLabelText("最初に出す方"), { target: { value: "answer" } });
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    expect(screen.getByText("alpha")).toBeTruthy();
  });
  it("テスト設定でも問答方向を選択できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText(/英語第1章 第1〜20語/));
    fireEvent.click(screen.getByRole("button", { name: /テスト/ }));
    expect((screen.getByLabelText("最初に出す方") as HTMLSelectElement).value).toBe("question");
    fireEvent.change(screen.getByLabelText("最初に出す方"), { target: { value: "answer" } });
    fireEvent.click(screen.getByRole("button", { name: /この設定でテストを始める/ }));
    expect(screen.getByText("alpha")).toBeTruthy();
  });
  it("練習設定の続きからをオンにすると、保存された途中のカードから再開する", () => {
    window.localStorage.setItem("studyverse-practice-continue", JSON.stringify({ version: 1, subject: "英単語", words: [{ id: 101, front: "alpha", back: "最初" }, { id: 102, front: "beta", back: "次" }], index: 1, result: { known: 1, review: 0 }, missedWords: [], order: "normal", pool: "normal", savedAt: "2026-08-27T00:00:00.000Z" }));
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    const continueButton = screen.getByRole("switch", { name: /続きから/ });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(continueButton);
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    expect(screen.getByText("練習 2 / 2")).toBeTruthy();
    expect(screen.getByText("次")).toBeTruthy();
  });
  it("英単語カードを裏返すと英語音声を再生する", async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; lang = ""; rate = 1; pitch = 1; constructor(text: string) { this.text = text; } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak, cancel } });
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByLabelText("単語カードをスワイプ"));
    await waitFor(() => expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "alpha", lang: "en-US" })));
  });
  it("練習設定で英単語音声をオフにすると反転しても再生しない", async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; constructor(text: string) { this.text = text; } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak, cancel } });
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    const voiceSwitch = screen.getByRole("switch", { name: /英単語の音声/ });
    expect(voiceSwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(voiceSwitch);
    expect(voiceSwitch.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByLabelText("単語カードをスワイプ"));
    await act(async () => {});
    expect(speak).not.toHaveBeenCalled();
  });
  it("漢字の練習設定には英単語の音声切替を表示しない", () => {
    render(<CardsWorkspace books={{ ...books, 漢字: [{ id: "kanji", name: "漢字教材", words: [{ front: "学", back: "まなぶ" }] }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByText("漢字第1章"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    expect(screen.queryByRole("switch", { name: /英単語の音声/ })).toBeNull();
  });
  it("先生配信テストを開始できる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText(/配信教材/));
    expect(screen.getByText("テストの設定")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /この設定でテストを始める/ }));
    expect(screen.getByText("三番目")).toBeTruthy();
  });
  it("スマホで指を離した時にカードを左右へスワイプできる", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 220 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 220 });
    expect(screen.getByText("意味2")).toBeTruthy();
  });
  it("上方向のスワイプを瞬答として保存し、二重丸マークを表示する", async () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 2, clientX: 100, clientY: 300 });
    fireEvent.pointerMove(card, { pointerId: 2, clientX: 105, clientY: 170 });
    expect(screen.getByText("◎")).toBeTruthy();
    fireEvent.pointerUp(card, { pointerId: 2, clientX: 105, clientY: 170 });
    expect(screen.getByText("意味2")).toBeTruthy();
    await waitFor(() => expect(hooks.recordAnswer).toHaveBeenCalledWith(expect.objectContaining({ practiceRating: "instant", isCorrect: true })));
  });
  it("下方向のスワイプを遅答として復習対象に保存する", async () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(card, { pointerId: 3, clientX: 105, clientY: 230 });
    fireEvent.pointerUp(card, { pointerId: 3, clientX: 105, clientY: 230 });
    expect(screen.getByText("意味2")).toBeTruthy();
    await waitFor(() => expect(hooks.recordAnswer).toHaveBeenCalledWith(expect.objectContaining({ practiceRating: "slow", isCorrect: true })));
  });
  it("判定メーターから単語を開いて再練習すると学習記録を追加しない", async () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    expect(screen.getByText("判定メーター")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /THINK \/ DELAY/ }));
    expect(screen.getByText("alpha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "練習モード" }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 4, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(card, { pointerId: 4, clientX: 220, clientY: 100 });
    fireEvent.pointerUp(card, { pointerId: 4, clientX: 220, clientY: 100 });
    await act(async () => {});
    expect(hooks.recordAnswer).not.toHaveBeenCalled();
  });
  it("ポインターが取り消されても、移動済みのカードは次のカードへ進む", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    const card = screen.getByLabelText("単語カードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 200 });
    fireEvent.pointerCancel(card, { pointerId: 1 });
    expect(screen.getByText("意味2")).toBeTruthy();
  });
  it("練習を途中で終了すると、続きから用の進行位置を端末に保存する", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    fireEvent.click(screen.getByRole("button", { name: /GREAT \/ PERFECT/ }));
    fireEvent.click(screen.getByRole("button", { name: "終了する" }));
    expect(JSON.parse(window.localStorage.getItem("studyverse-practice-continue") ?? "{}" )).toMatchObject({ version: 1, subject: "英単語", index: 1, result: { known: 1, review: 0 } });
    expect(screen.getByText("保存済みの学習セット")).toBeTruthy();
  });
  it("練習を開始すると、続きから用の先頭位置を端末に保存する", () => {
    render(<CardsWorkspace books={books} />);
    fireEvent.click(screen.getByText("英語第1章 第1〜20語"));
    fireEvent.click(screen.getByRole("button", { name: /練習/ }));
    fireEvent.click(screen.getByRole("button", { name: /この設定で練習する/ }));
    expect(JSON.parse(window.localStorage.getItem("studyverse-practice-continue") ?? "{}" )).toMatchObject({ version: 1, index: 0, words: expect.any(Array) });
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
    expect(screen.getByText("復習対象一覧（1問）")).toBeTruthy();
    expect(screen.getByText("答え：gamma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "復習対象だけをもう一度テストする" }));
    expect(screen.getByText(/テスト 1 \/ 1/)).toBeTruthy();
  });
});
