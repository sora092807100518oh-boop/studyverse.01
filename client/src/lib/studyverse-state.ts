export type StudyWord = { front: string; back: string; reading?: string; known?: boolean };

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
