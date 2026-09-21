import type { JevAnswer, Verdict } from "../lib/checkkit.js";
import { APP_MARK, APP_NAME, choiceLabel, VERDICT_LABELS } from "../lib/labels.js";
import { useLocale } from "./useLocale.js";

export function AppHeader({ meta }: { meta?: string }) {
  return (
    <header className="app-header">
      <div className="app-name">
        <span className="app-mark">{APP_MARK}</span>
        {APP_NAME}
      </div>
      {meta ? <div className="app-meta">{meta}</div> : null}
    </header>
  );
}

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
  const locale = useLocale();
  if (answer === undefined) return null;
  if (answer.type === "noul") {
    return <p className="numeric">{answer.noul.toFixed(2)}</p>;
  }
  if (answer.type === "choice") {
    return (
      <p className="numeric">
        {choiceLabel(id, answer.choice, locale)}　{answer.confidence.toFixed(2)}
      </p>
    );
  }
  return (
    <p className="numeric">
      {answer.score.toFixed(2)}　{answer.confidence.toFixed(2)}
    </p>
  );
}
