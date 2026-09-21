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

type AxisAnswer = { type: "noul"; noul: number } | { type: "score"; score: number } | { type: "choice" };

/** Same 0–1 scale the old meters used. Choice has no meter; map the verdict. */
export function axisValue(item: { verdict: Verdict; answer?: AxisAnswer } | undefined): number | null {
  if (item === undefined) return null;
  if (item.verdict === "not_applicable" || item.verdict === "error") return null;
  const answer = item.answer;
  if (answer === undefined) return null;
  return answerMagnitude(answer, item.verdict);
}

function answerMagnitude(answer: AxisAnswer, verdict: Verdict): number {
  if (answer.type === "noul") return clamp01(answer.noul);
  if (answer.type === "score") return clamp01(answer.score / 2);
  if (verdict === "pass") return 1;
  if (verdict === "fail") return 0;
  return 0.5;
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
