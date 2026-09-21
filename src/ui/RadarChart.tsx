import { useLayoutEffect, useState } from "react";
import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "../lib/groups.js";
import { questionAxisLabel, questionLabel, VERDICT_LABELS } from "../lib/labels.js";
import { polarPoint, radarAxes, type RadarAxis } from "../lib/radar-values.js";
import type { ItemResult, Verdict } from "../lib/checkkit.js";

const RINGS = [1 / 3, 2 / 3, 1];
const GROW_MS = 1100;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Slow seed, then a readable rise so the shape change is obvious. */
function readableEase(t: number): number {
  if (t < 0.14) return (t / 0.14) * 0.1;
  const u = (t - 0.14) / 0.86;
  return 0.1 + 0.9 * (1 - (1 - u) * (1 - u));
}

function useGrow(durationMs: number): number {
  const [progress, setProgress] = useState(() => (reducedMotion() ? 1 : 0));
  useLayoutEffect(() => {
    if (reducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      setProgress(readableEase(t));
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

function perimeter(axes: readonly RadarAxis[], radius: number, valueOf: (axis: RadarAxis) => number): number {
  const points = axes.map((axis, index) => polarPoint(index, axes.length, valueOf(axis), radius));
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    if (from === undefined || to === undefined) continue;
    length += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return length;
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
    const verdict = axis.verdict === null ? "—" : VERDICT_LABELS[axis.verdict];
    const value = axis.value === null ? "N/A" : axis.value.toFixed(2);
    return `${axis.fullLabel} ${verdict} ${value}`;
  });
  return `${title}のレーダー。${parts.join("。")}`;
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
        <p className="radar-empty">{title}: N/A</p>
      </div>
    );
  }

  const valueOf = (axis: RadarAxis) => (axis.value ?? 0) * grow;
  const grid = RINGS.map((ring) => pointsAttr(axes, radius, () => ring));
  const plot = pointsAttr(axes, radius, valueOf);
  const outline = Math.max(perimeter(axes, radius, valueOf), 1);

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
          <polygon className="radar-area" points={plot} style={{ opacity: 0.35 + 0.65 * grow }} />
          <polygon
            className="radar-outline"
            points={plot}
            pathLength={outline}
            style={{ strokeDasharray: outline, strokeDashoffset: outline * (1 - grow) }}
          />
          {axes.map((axis, index) => {
            if (axis.value === null || grow < 0.12) return null;
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
