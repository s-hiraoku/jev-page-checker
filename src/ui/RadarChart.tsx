import { useEffect, useState } from "react";
import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "../lib/groups.js";
import { questionAxisLabel, questionLabel, VERDICT_LABELS } from "../lib/labels.js";
import { polarPoint, radarAxes, type RadarAxis } from "../lib/radar-values.js";
import type { ItemResult, Verdict } from "../lib/checkkit.js";

const RINGS = [1 / 3, 2 / 3, 1];
const GROW_MS = 800;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function useGrow(durationMs: number): number {
  const [progress, setProgress] = useState(() => (reducedMotion() ? 1 : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      setProgress(easeInOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs]);
  return progress;
}

function pointsAttr(axes: readonly RadarAxis[], radius: number, valueOf: (axis: RadarAxis) => number): string {
  return axes
    .map((axis, index) => {
      const point = polarPoint(index, axes.length, valueOf(axis), radius);
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function labelLayout(index: number, total: number, radius: number): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const point = polarPoint(index, total, 1, radius + 16);
  const unit = polarPoint(index, total, 1, 1);
  let anchor: "start" | "middle" | "end" = "middle";
  if (unit.x > 0.35) anchor = "start";
  else if (unit.x < -0.35) anchor = "end";
  return { x: point.x, y: point.y + (unit.y > 0.35 ? 4 : unit.y < -0.35 ? -2 : 3), anchor };
}

function describeAxes(title: string, axes: readonly RadarAxis[]): string {
  const parts = axes.map((axis) => {
    const verdict = axis.verdict === null ? "未測定" : VERDICT_LABELS[axis.verdict];
    const value = axis.value === null ? "対象外" : axis.value.toFixed(2);
    return `${axis.fullLabel} ${verdict} ${value}`;
  });
  return `${title}の検査結果レーダー。${parts.join("。")}`;
}

export function RadarChart({
  title,
  axes,
  compact = false,
  verdict,
}: {
  title: string;
  axes: readonly RadarAxis[];
  compact?: boolean;
  verdict: Verdict;
}) {
  const measured = axes.some((axis) => axis.value !== null);
  const radius = compact ? 52 : 78;
  const size = compact ? 200 : 260;
  const grow = useGrow(GROW_MS);

  if (!measured) {
    return (
      <div className="radar-card">
        <h3>{title}</h3>
        <p className="radar-empty">{title}の項目は対象外です</p>
      </div>
    );
  }

  const grid = RINGS.map((ring) => pointsAttr(axes, radius, () => ring));
  const plot = pointsAttr(axes, radius, (axis) => (axis.value ?? 0) * grow);

  return (
    <div className="radar-card">
      <h3>{title}</h3>
      <svg
        className={`radar-svg radar-${verdict}`}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        width="100%"
        role="img"
        aria-label={describeAxes(title, axes)}
      >
        <g className="radar-grid" aria-hidden="true">
          {grid.map((points) => (
            <polygon key={points} points={points} />
          ))}
          {axes.map((axis, index) => {
            const end = polarPoint(index, axes.length, 1, radius);
            return <line key={axis.id} x1={0} y1={0} x2={end.x} y2={end.y} />;
          })}
        </g>
        <g className="radar-plot">
          <polygon className="radar-area" points={plot} />
          {axes.map((axis, index) => {
            if (axis.value === null) return null;
            const point = polarPoint(index, axes.length, axis.value * grow, radius);
            return <circle key={axis.id} className="radar-dot" cx={point.x} cy={point.y} r={compact ? 2.4 : 3} />;
          })}
        </g>
        <g className="radar-labels" aria-hidden="true">
          {axes.map((axis, index) => {
            const layout = labelLayout(index, axes.length, radius);
            return (
              <text
                key={axis.id}
                x={layout.x}
                y={layout.y}
                textAnchor={layout.anchor}
                className={axis.value === null ? "radar-label muted" : "radar-label"}
              >
                <title>{axis.fullLabel}</title>
                {axis.label}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function ResultRadars({ items, compact = false }: { items: readonly ItemResult[]; compact?: boolean }) {
  const site = radarAxes(items, SITE_QUESTION_IDS, questionLabel, questionAxisLabel);
  const page = radarAxes(items, PAGE_QUESTION_IDS, questionLabel, questionAxisLabel);
  return (
    <div className={`radar-pair${compact ? " compact" : ""}`}>
      <RadarChart title="サイト" axes={site} compact={compact} verdict={worstVerdict(items, SITE_QUESTION_IDS)} />
      <RadarChart title="本文" axes={page} compact={compact} verdict={worstVerdict(items, PAGE_QUESTION_IDS)} />
    </div>
  );
}
