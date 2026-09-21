import type { Check } from "../lib/checkkit.js";
import { basisEntries, choiceLabel, instructionLabel, instructionText, questionLabel } from "../lib/labels.js";
import type { Copy } from "../lib/copy.js";
import type { ResolvedLocale } from "../lib/locale.js";
import { useCopy, useLocale } from "./useLocale.js";

function branchLabel(check: Check, key: string, locale: ResolvedLocale, copy: Copy): string {
  if (check.type === "noul") return key === "true" ? copy.branchYes : copy.branchNo;
  if (check.type === "score") return key;
  return choiceLabel(check.id, key, locale);
}

function thresholdText(check: Check, copy: Copy): string {
  if (check.type === "noul") return copy.noulBand(check.passAt ?? 0.8, check.failAt ?? 0.2);
  if (check.type === "score") return copy.scoreBand(check.passAt, check.failAt, check.confidenceFloor ?? 0.6);
  return copy.choiceFloor(check.confidenceFloor ?? 0.6);
}

function asksWhenArticle(check: Check): boolean {
  return check.applyWhen?.op === "equals" && check.applyWhen.path === "hasArticle" && check.applyWhen.value === true;
}

export function ChecklistView({ questions }: { questions: readonly Check[] }) {
  const copy = useCopy();
  const locale = useLocale();
  return (
    <section>
      <h2 className="page-title">{copy.questions(questions.length)}</h2>
      <div className="question-text-card">
        <h3>{copy.questionText}</h3>
        <p>{copy.definitionLanguage}</p>
      </div>
      {questions.map((check) => (
        <article className="checklist-item" key={check.id}>
          <h3>
            {questionLabel(check.id, locale)} <span className="url">{check.id}</span>
          </h3>
          <p className="help">{instructionLabel(check.id, locale, instructionText(check))}</p>
          {check.type === "choice" && check.citeFor !== undefined ? (
            <p className="help">{copy.citeChoices}</p>
          ) : (
            <p className="help">{thresholdText(check, copy)}</p>
          )}
          {asksWhenArticle(check) ? <p className="help">{copy.articleOnly}</p> : null}
          <ul className="checklist-criteria">
            {basisEntries(check.id, locale).map((entry) => (
              <li key={entry.key}>
                <span className="checklist-key">{branchLabel(check, entry.key, locale, copy)}</span>
                {entry.text}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
