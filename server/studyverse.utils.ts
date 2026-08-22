export type CsvPreviewRow = { line: number; front: string; back: string; valid: boolean; reason?: string };

function isVocabularyHeader(front: string, back: string) {
  const normalizedFront = front.trim().toLocaleLowerCase();
  const normalizedBack = back.trim().toLocaleLowerCase();
  return ["単語", "英単語", "word", "words", "term", "表面", "front"].includes(normalizedFront)
    && ["意味", "訳", "日本語", "meaning", "definition", "裏面", "back"].includes(normalizedBack);
}

export function previewVocabularyRows(text: string, maxRows = 3000): CsvPreviewRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").map((line, index) => ({ line, lineNumber: index + 1 })).filter(item => item.line.trim().length > 0);
  if (lines.length > maxRows) throw new Error("CSV_LIMIT_EXCEEDED");
  return lines.reduce<CsvPreviewRow[]>((rows, { line, lineNumber }) => {
    const [front = "", back = ""] = line.split(line.includes("\t") ? "\t" : ",").map(cell => cell.trim());
    if (isVocabularyHeader(front, back)) return rows;
    if (!front || !back) return rows;
    if (front.length > 500 || back.length > 500) { rows.push({ line: lineNumber, front, back, valid: false, reason: "1項目は500文字以内にしてください。" }); return rows; }
    rows.push({ line: lineNumber, front, back, valid: true });
    return rows;
  }, []);
}

export function classifyCardResult(answer: string, expected: string) {
  return answer.trim().normalize("NFKC").toLocaleLowerCase() === expected.trim().normalize("NFKC").toLocaleLowerCase();
}
