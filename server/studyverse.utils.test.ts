import { describe, expect, it } from "vitest";
import { classifyCardResult, previewVocabularyRows } from "./studyverse.utils";

describe("previewVocabularyRows", () => {
  it("BOM・CRLF・タブ区切りを正規化してプレビューする", () => {
    const rows = previewVocabularyRows("\uFEFFobserve\t観察する\r\nretain\t保持する");
    expect(rows).toEqual([
      { line: 1, front: "observe", back: "観察する", valid: true },
      { line: 2, front: "retain", back: "保持する", valid: true },
    ]);
  });

  it("空欄を含む行は無視し、有効な行だけを返す", () => {
    const rows = previewVocabularyRows("observe,\n,保持する\nretain,保持する");
    expect(rows).toEqual([{ line: 3, front: "retain", back: "保持する", valid: true }]);
  });

  it("単語・意味のヘッダー行を自動で除外する", () => {
    expect(previewVocabularyRows("単語,意味\nobserve,観察する")).toEqual([
      { line: 2, front: "observe", back: "観察する", valid: true },
    ]);
  });

  it("最大件数を超えるCSVを拒否する", () => {
    expect(() => previewVocabularyRows("a,b\nc,d\ne,f", 2)).toThrow("CSV_LIMIT_EXCEEDED");
  });
});

describe("classifyCardResult", () => {
  it("全角・半角と英字の大文字小文字を吸収して比較する", () => {
    expect(classifyCardResult(" ＯＢＳＥＲＶＥ ", "observe")).toBe(true);
    expect(classifyCardResult("analyse", "observe")).toBe(false);
  });
});
