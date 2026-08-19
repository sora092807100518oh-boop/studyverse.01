export type CsvPreviewRow = { line: number; front: string; back: string; valid: boolean; reason?: string };

export function previewVocabularyRows(text: string, maxRows = 3000): CsvPreviewRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter(line => line.trim().length > 0);
  if (lines.length > maxRows) throw new Error("CSV_LIMIT_EXCEEDED");
  return lines.map((line, index) => {
    const [front = "", back = ""] = line.split(line.includes("\t") ? "\t" : ",").map(cell => cell.trim());
    if (!front || !back) return { line: index + 1, front, back, valid: false, reason: "表面と裏面の両方が必要です。" };
    if (front.length > 500 || back.length > 500) return { line: index + 1, front, back, valid: false, reason: "1項目は500文字以内にしてください。" };
    return { line: index + 1, front, back, valid: true };
  });
}

export function classifyCardResult(answer: string, expected: string) {
  return answer.trim().normalize("NFKC").toLocaleLowerCase() === expected.trim().normalize("NFKC").toLocaleLowerCase();
}
