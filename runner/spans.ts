export interface PageSpan {
  id: string;
  text: string;
}

const MAX_SPANS = 8;
const MIN_CHARS = 40;

function scoreSentence(sentence: string): number {
  let score = 0;
  if (/\d/.test(sentence)) score += 2;
  if (/[「」""''“”]/.test(sentence)) score += 2;
  return score;
}

/** Sentences cut from the page text. The rule is the same for every URL. */
export function extractSpans(text: string): PageSpan[] {
  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => [...sentence].length >= MIN_CHARS);
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_SPANS)
    .sort((left, right) => left.index - right.index);
  return ranked.map((span, index) => ({ id: `s${index + 1}`, text: span.sentence }));
}
