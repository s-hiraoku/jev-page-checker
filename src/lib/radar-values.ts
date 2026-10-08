import type { ItemResult, Verdict } from "./checkkit.js";

export type RadarAxis = {
  id: string;
  label: string;
  fullLabel: string;
  value: number | null;
  verdict: Verdict | null;
};

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

type AxisAnswer = { type: "noul"; noul: number } | { type: "score"; score: number } | { type: "choice"; confidence?: number };

/** Ring radii. Each verdict owns one band, so where a point sits always agrees with its chip. */
export const RADAR_BANDS = { fail: [0, 1 / 3], review: [1 / 3, 2 / 3], pass: [2 / 3, 1] } as const;

/** Same pass lines as runner/evaluate.ts; the checker's noul questions use the defaults. */
const NOUL_PASS_AT = 0.8;
const NOUL_FAIL_AT = 0.2;
/** Choice confidence below this is Review (the definition's confidenceFloor). */
const CHOICE_FLOOR = 0.6;

/**
 * 0–1 radius for one answered item. The verdict picks the band and the answer's strength
 * picks the place inside it: a Review is never drawn on the Pass ring, whatever its number.
 */
export function axisValue(item: { verdict: Verdict; answer?: AxisAnswer } | undefined): number | null {
  if (item === undefined) return null;
  if (item.verdict !== "pass" && item.verdict !== "review" && item.verdict !== "fail") return null;
  const answer = item.answer;
  if (answer === undefined) return null;
  const [low, high] = RADAR_BANDS[item.verdict];
  return low + (high - low) * strength(answer, item.verdict);
}

/** 0–1 place inside the verdict's band; 1 is the outer edge of the band. */
function strength(answer: AxisAnswer, verdict: "pass" | "review" | "fail"): number {
  if (answer.type === "noul") {
    if (verdict === "pass") return clamp01((answer.noul - NOUL_PASS_AT) / (1 - NOUL_PASS_AT));
    if (verdict === "fail") return clamp01(answer.noul / NOUL_FAIL_AT);
    return clamp01((answer.noul - NOUL_FAIL_AT) / (NOUL_PASS_AT - NOUL_FAIL_AT));
  }
  if (answer.type === "score") return clamp01(answer.score / 2);
  if (verdict === "review" || answer.confidence === undefined) return 0.5;
  const sure = clamp01((answer.confidence - CHOICE_FLOOR) / (1 - CHOICE_FLOOR));
  return verdict === "pass" ? sure : 1 - sure;
}

export function radarAxes(
  items: readonly ItemResult[],
  ids: readonly string[],
  label: (id: string) => string,
  axisLabel: (id: string) => string,
): RadarAxis[] {
  const byId = new Map<string, ItemResult>(items.map((item) => [item.id, item]));
  return ids.map((id) => {
    const item = byId.get(id);
    return {
      id,
      label: axisLabel(id),
      fullLabel: label(id),
      value: axisValue(item),
      verdict: item?.verdict ?? null,
    };
  });
}

export function polarPoint(index: number, total: number, value: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index / Math.max(total, 1)) * 2 * Math.PI;
  return { x: Math.cos(angle) * radius * value, y: Math.sin(angle) * radius * value };
}
