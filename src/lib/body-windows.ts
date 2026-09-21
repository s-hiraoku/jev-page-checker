import {
  bodyTokenBudget,
  bodyWindowCharBudget,
  endIndexForTokenBudget,
  estimateTokens,
  JEV_ENGLISH_CHARS_PER_TOKEN,
  trimToTokenBudget,
} from "./jev-budget.js";

/** Max Jev windows for one main body. Universal; not a per-URL knob. */
export const MAX_BODY_WINDOWS = 8;

export interface BodyWindow {
  text: string;
  start: number;
  end: number;
}

export function chunkOverlap(windowChars: number): number {
  const size = Math.max(1, Math.floor(windowChars));
  return Math.max(1, Math.min(Math.floor(size * 0.15), size - 1));
}

/** How many main-body characters overlapping English-density windows can cover. */
export function bodyCollectLimit(maxTokens = bodyTokenBudget()): number {
  const size = bodyWindowCharBudget(maxTokens);
  const overlap = chunkOverlap(size);
  return size * MAX_BODY_WINDOWS - overlap * (MAX_BODY_WINDOWS - 1);
}

export function splitOverlappingChunks(
  text: string,
  maxTokens = bodyTokenBudget(),
): { windows: BodyWindow[]; covered: boolean } {
  const budget = Math.max(1, Math.floor(maxTokens));
  if (text.length === 0) return { windows: [{ text: "", start: 0, end: 0 }], covered: true };
  if (estimateTokens(text) <= budget) return { windows: [{ text, start: 0, end: text.length }], covered: true };

  const windows: BodyWindow[] = [];
  let start = 0;
  while (windows.length < MAX_BODY_WINDOWS) {
    const end = endIndexForTokenBudget(text, start, budget);
    windows.push({ text: text.slice(start, end), start, end });
    if (end >= text.length) break;
    const windowChars = end - start;
    const overlap = windowChars <= 1 ? 0 : chunkOverlap(windowChars);
    let next = end - overlap;
    if (next <= start) next = start + 1;
    start = next;
  }
  const last = windows[windows.length - 1];
  return { windows, covered: last !== undefined && last.end === text.length };
}

export function overlapSlice(text: string, left: BodyWindow, right: BodyWindow): string {
  const start = Math.max(left.start, right.start);
  const end = Math.min(left.end, right.end);
  if (end <= start) return "";
  return text.slice(start, end);
}

export function packSynthesisText(
  text: string,
  windows: readonly BodyWindow[],
  findingLines: readonly string[],
  maxTokens = bodyTokenBudget(),
): string {
  const budget = Math.max(1, Math.floor(maxTokens));
  const parts: string[] = [
    "The following is one piece of writing inspected in overlapping windows. Judge the whole writing, including contradictions, unsourced particulars, and evidence that appear across windows rather than inside a single window.",
    "",
    "## Per-window answers",
    ...findingLines,
  ];
  const overlapParts: string[] = ["", "## Adjacent overlaps"];
  for (let index = 0; index < windows.length - 1; index += 1) {
    const left = windows[index];
    const right = windows[index + 1];
    if (left === undefined || right === undefined) continue;
    const overlap = overlapSlice(text, left, right);
    overlapParts.push(`### Windows ${index + 1}–${index + 2}`, overlap || "(no overlap)");
  }
  let packed = [...parts, ...overlapParts].join("\n");
  if (estimateTokens(packed) >= budget) return trimToTokenBudget(packed, budget);

  const unique = windows.map((window, index) => {
    const previousEnd = index === 0 ? 0 : (windows[index - 1]?.end ?? 0);
    const start = Math.max(window.start, previousEnd);
    return text.slice(start, window.end);
  });
  const remaining = Math.max(1, budget - estimateTokens(packed));
  const share = Math.max(1, Math.floor((remaining * JEV_ENGLISH_CHARS_PER_TOKEN) / Math.max(unique.length, 1)));
  const excerpts = unique.map((chunk, index) => `### Window ${index + 1} remainder\n${chunk.slice(0, share)}`);
  packed = `${packed}\n\n## Per-window remainders\n${excerpts.join("\n")}`;
  return trimToTokenBudget(packed, budget);
}
