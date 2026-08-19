import { describe, expect, it } from "vitest";
import { deleteStudyWord, getSwipeOutcome, saveStudyWord, searchStudyWords } from "./studyverse-state";

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
