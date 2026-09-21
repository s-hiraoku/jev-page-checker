/** Max Jev windows for one main body. Universal; not a per-URL knob. */
export const MAX_BODY_WINDOWS = 8;

export interface BodyWindow {
  text: string;
  start: number;
  end: number;
}

export function chunkOverlap(maxChars: number): number {
  const size = Math.max(1, Math.floor(maxChars));
  return Math.max(1, Math.min(Math.floor(size * 0.15), size - 1));
}

/** How many main-body characters overlapping windows can cover. */
export function bodyCollectLimit(maxChars: number): number {
  const size = Math.max(1, Math.floor(maxChars));
  const overlap = chunkOverlap(size);
  return size * MAX_BODY_WINDOWS - overlap * (MAX_BODY_WINDOWS - 1);
}

export function splitOverlappingChunks(text: string, maxChars: number): { windows: BodyWindow[]; covered: boolean } {
  const size = Math.max(1, Math.floor(maxChars));
  if (text.length === 0) return { windows: [{ text: "", start: 0, end: 0 }], covered: true };
  if (text.length <= size) return { windows: [{ text, start: 0, end: text.length }], covered: true };

  const step = Math.max(1, size - chunkOverlap(size));
  const windows: BodyWindow[] = [];
  let start = 0;
  while (windows.length < MAX_BODY_WINDOWS) {
    const end = Math.min(start + size, text.length);
    windows.push({ text: text.slice(start, end), start, end });
    if (end >= text.length) break;
    start += step;
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
  maxChars: number,
): string {
  const size = Math.max(1, Math.floor(maxChars));
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
  if (packed.length >= size) return packed.slice(0, size);

  const remaining = size - packed.length;
  const unique = windows.map((window, index) => {
    const previousEnd = index === 0 ? 0 : (windows[index - 1]?.end ?? 0);
    const start = Math.max(window.start, previousEnd);
    return text.slice(start, window.end);
  });
  const share = Math.max(1, Math.floor(remaining / Math.max(unique.length, 1)));
  const excerpts = unique.map((chunk, index) => `### Window ${index + 1} remainder\n${chunk.slice(0, share)}`);
  packed = `${packed}\n\n## Per-window remainders\n${excerpts.join("\n")}`;
  return packed.slice(0, size);
}
