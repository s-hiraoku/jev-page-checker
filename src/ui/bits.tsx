import type { JevAnswer, Verdict } from "../lib/checkkit.js";
import { APP_MARK, APP_NAME, basisEntries, choiceLabel } from "../lib/labels.js";
import type { ResolvedLocale } from "../lib/locale.js";
import { useCopy, useLocale } from "./useLocale.js";

export function AppHeader({ meta }: { meta?: string }) {
  return (
    <header className="app-header">
      <div className="app-name">
        <span className="app-mark">{APP_MARK}</span>
        <span className="app-title">{APP_NAME}</span>
      </div>
      {meta ? <div className="app-meta">{meta}</div> : null}
    </header>
  );
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return <span className={`chip chip-${verdict}`}>{useCopy().verdictLabels[verdict]}</span>;
}

export function Lane({ title, verdict }: { title: string; verdict: Verdict }) {
  const copy = useCopy();
  return (
    <div className={`lane lane-${verdict}`}>
      <strong>{title}</strong>
      <div className={`verdict verdict-${verdict}`}>{copy.verdictLabels[verdict]}</div>
    </div>
  );
}

export function AnswerView({ id, answer }: { id: string; answer?: JevAnswer }) {
  const locale = useLocale();
  const copy = useCopy();
  if (answer === undefined) return null;
  if (answer.type === "noul") {
    return (
      <div className="answer-view answer-noul">
        <p><span>{copy.answerProbability}</span><strong>{percent(answer.noul, locale)}</strong></p>
        <meter min="0" max="1" value={answer.noul} aria-label={`${copy.answerProbability}: ${percent(answer.noul, locale)}`} />
      </div>
    );
  }
  if (answer.type === "choice") {
    return (
      <div className="answer-view">
        <strong className="answer-label">{choiceLabel(id, answer.choice, locale)}</strong>
        <p className="answer-metric"><span>{copy.answerConfidence}</span><strong>{percent(answer.confidence, locale)}</strong></p>
        <details className="answer-distribution">
          <summary>{copy.probabilityDetails}</summary>
          <ul>
            {Object.entries(answer.probabilities)
              .sort((left, right) => right[1] - left[1])
              .map(([key, probability]) => (
                <li key={key}>
                  <span>{choiceLabel(id, key, locale)}</span>
                  <strong>{percent(probability, locale)}</strong>
                </li>
              ))}
          </ul>
        </details>
      </div>
    );
  }
  const rubric = new Map(basisEntries(id, locale).map((entry) => [entry.key, entry.text]));
  return (
    <div className="answer-view">
      <p className="answer-metric"><span>{copy.score}</span><strong>{answer.score.toFixed(2)}</strong></p>
      <p className="answer-metric"><span>{copy.scoreConfidence}</span><strong>{percent(answer.confidence, locale)}</strong></p>
      <details className="answer-distribution">
        <summary>{copy.scoreDistribution}</summary>
        <ul>
          {Object.entries(answer.probabilities)
            .sort((left, right) => Number(left[0]) - Number(right[0]))
            .map(([key, probability]) => (
              <li key={key}>
                <span>{rubric.get(key) ?? (answer.legend as Record<string, string>)[key] ?? key}</span>
                <strong>{percent(probability, locale)}</strong>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}

function percent(value: number, locale: ResolvedLocale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
}
