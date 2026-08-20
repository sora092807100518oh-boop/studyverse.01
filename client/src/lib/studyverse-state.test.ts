import { describe, expect, it } from "vitest";
import { advanceTestSession, clearStrokes, deleteStudyWord, getElapsedFocusSeconds, getFocusTimerRemaining, getSwipeOutcome, saveAnswerAndGetProgress, saveStudyWord, searchStudyWords, undoStroke } from "./studyverse-state";

const words = [
  { front: "observe", back: "観察する" },
  { front: "retain", back: "保持する" },
];

describe("単語帳の状態処理", () => {
  it("表面または裏面で単語を検索できる", () => {
    expect(searchStudyWords(words, "保持")).toEqual([{ word: words[1], index: 1 }]);
    expect(searchStudyWords(words, "OBSERVE")).toEqual([{ word: words[0], index: 0 }]);
  });

  it("単語を追加・編集・削除できる", () => {
    const added = saveStudyWord(words, { front: "sustain", back: "維持する" }, null);
    expect(added).toHaveLength(3);
    const edited = saveStudyWord(added, { front: "retain", back: "保つ" }, 1);
    expect(edited[1]?.back).toBe("保つ");
    expect(deleteStudyWord(edited, 0)).toEqual([edited[1], edited[2]]);
  });
});

describe("カードスワイプ", () => {
  it("右スワイプを覚えた、左スワイプを復習として判定する", () => {
    expect(getSwipeOutcome(120)).toBe("known");
    expect(getSwipeOutcome(-120)).toBe("review");
    expect(getSwipeOutcome(20)).toBeNull();
  });
});

describe("学習タイマー", () => {
  it("画面遷移後も開始時刻を基準に経過時間と残り時間を計算する", () => {
    expect(getElapsedFocusSeconds(1_000, 64_900)).toBe(63);
    expect(getElapsedFocusSeconds(1_000, 64_900, 3)).toBe(60);
    expect(getFocusTimerRemaining(60)).toBe(1440);
    expect(getFocusTimerRemaining(2000)).toBe(0);
  });
});

describe("テスト進行と手書き回答", () => {
  it("英単語テストで正誤を集計し、最終問題では結果画面へ遷移する", () => {
    expect(advanceTestSession(0, 3, true, 0, 0)).toEqual({ nextIndex: 1, known: 1, review: 0, completed: false });
    expect(advanceTestSession(2, 3, false, 2, 0)).toEqual({ nextIndex: 3, known: 2, review: 1, completed: true });
  });

  it("漢字キャンバスの一画戻しと全消去を処理する", () => {
    const strokes = [[{ x: 1, y: 1 }, { x: 2, y: 2 }], [{ x: 4, y: 4 }]];
    expect(undoStroke(strokes)).toEqual([strokes[0]]);
    expect(clearStrokes()).toEqual([]);
  });
});

describe("回答記録の保存", () => {
  it("保存が成功してから次の問題または結果画面向けの進行状態を返す", async () => {
    let persisted = false;
    const progress = await saveAnswerAndGetProgress(async () => {
      persisted = true;
    }, 1, 2, true, 1, 0);

    expect(persisted).toBe(true);
    expect(progress).toEqual({ nextIndex: 2, known: 2, review: 0, completed: true });
  });

  it("保存に失敗した場合は進行状態を返さず、呼び出し側で再試行できる", async () => {
    await expect(saveAnswerAndGetProgress(async () => {
      throw new Error("保存に失敗しました");
    }, 0, 2, false, 0, 0)).rejects.toThrow("保存に失敗しました");
  });
});
