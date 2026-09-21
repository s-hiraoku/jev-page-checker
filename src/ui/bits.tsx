import type { JevAnswer, Verdict } from "../lib/checkkit.js";
import { choiceLabel, VERDICT_LABELS } from "../lib/labels.js";

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return <span className={`chip chip-${verdict}`}>{VERDICT_LABELS[verdict]}</span>;
}

export function Lane({ title, verdict }: { title: string; verdict: Verdict }) {
  return (
    <div className="lane">
      <strong>{title}</strong>
      <div className={`verdict verdict-${verdict}`}>{VERDICT_LABELS[verdict]}</div>
    </div>
  );
}

export function AnswerView({ id, answer }: { id: string; answer?: JevAnswer }) {
  if (answer === undefined) return null;
  if (answer.type === "noul") {
    return <p className="numeric">値 {answer.noul.toFixed(2)}</p>;
  }
  if (answer.type === "choice") {
    return (
      <p className="numeric">
        {choiceLabel(id, answer.choice)}　確信度 {answer.confidence.toFixed(2)}
      </p>
    );
  }
  return (
    <p className="numeric">
      値 {answer.score.toFixed(2)}　確信度 {answer.confidence.toFixed(2)}
    </p>
  );
}
