export type StudyWord = { id?: number; front: string; back: string; reading?: string; known?: boolean };

export function searchStudyWords(words: StudyWord[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !normalized || `${word.front} ${word.back}`.toLocaleLowerCase().includes(normalized));
}

export function saveStudyWord(words: StudyWord[], draft: StudyWord, editingIndex: number | null) {
  if (editingIndex === null) return [...words, draft];
  return words.map((word, index) => (index === editingIndex ? { ...word, ...draft } : word));
}

export function deleteStudyWord(words: StudyWord[], index: number) {
  return words.filter((_, candidate) => candidate !== index);
}

export function getSwipeOutcome(offsetX: number, threshold = 95): "known" | "review" | null {
  if (offsetX >= threshold) return "known";
  if (offsetX <= -threshold) return "review";
  return null;
}

export function getElapsedFocusSeconds(startedAtMs: number, nowMs: number, pausedSeconds = 0) {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000) - pausedSeconds);
}

export function getFocusTimerRemaining(elapsedSeconds: number, focusSeconds = 25 * 60) {
  return Math.max(0, focusSeconds - elapsedSeconds);
}

export function advanceTestSession(index: number, total: number, isCorrect: boolean, known: number, review: number) {
  const result = { known: known + (isCorrect ? 1 : 0), review: review + (isCorrect ? 0 : 1) };
  return { ...result, nextIndex: index + 1, completed: index + 1 >= total };
}

export async function saveAnswerAndGetProgress(
  persist: () => Promise<unknown>,
  index: number,
  total: number,
  isCorrect: boolean,
  known: number,
  review: number,
) {
  await persist();
  return advanceTestSession(index, total, isCorrect, known, review);
}

export type StrokePoint = { x: number; y: number };
export type Stroke = StrokePoint[];

export function undoStroke(strokes: Stroke[]) {
  return strokes.slice(0, -1);
}

export function clearStrokes() {
  return [] as Stroke[];
}
