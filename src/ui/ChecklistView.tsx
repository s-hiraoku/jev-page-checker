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

function ExactDefinition({ check, copy }: { check: Check; copy: Copy }) {
  const locale = useLocale();
  const criteria = check.criteria ? Object.entries(check.criteria) : [];
  const options = check.type === "choice" ? Object.entries(check.options) : [];
  return (
    <details className="exact-definition">
      <summary>{copy.seeExactDefinition}</summary>
      <p className="definition-key"><strong>{copy.internalId}:</strong> <code>{check.id}</code></p>
      <h4>{copy.exactInstructions}</h4>
      <p className="raw-instructions">{instructionText(check)}</p>
      {criteria.length ? (
        <>
          <h4>{copy.exactCriteria}</h4>
          <ul className="exact-criteria">
            {criteria.map(([key, value]) => (
              <li key={key}><code>{key}</code><span>{typeof value === "string" ? value : JSON.stringify(value)}</span></li>
            ))}
          </ul>
        </>
      ) : null}
      {options.length ? (
        <ul className="exact-options">
          {options.map(([key, verdict]) => <li key={key}><code>{key}</code><span>{choiceLabel(check.id, key, locale)} · {verdict}</span></li>)}
        </ul>
      ) : null}
      {check.applyWhen ? <p className="definition-key"><strong>{copy.appliesWhen}:</strong> <code>{JSON.stringify(check.applyWhen)}</code></p> : null}
    </details>
  );
}

function VerdictQuestion({ check, copy }: { check: Check; copy: Copy }) {
  const locale = useLocale();
  return (
    <article className="checklist-item">
      <h3>{questionLabel(check.id, locale)}</h3>
      <p className="help">{instructionLabel(check.id, locale, instructionText(check))}</p>
      {check.type === "choice" && check.citeFor !== undefined ? (
        <p className="help">{copy.referenceQuestionsHelp}</p>
      ) : <p className="help">{thresholdText(check, copy)}</p>}
      {asksWhenArticle(check) ? <p className="help">{copy.articleOnly}</p> : null}
      <ul className="checklist-criteria">
        {basisEntries(check.id, locale).map((entry) => (
          <li key={entry.key}>
            <span className="checklist-key">{branchLabel(check, entry.key, locale, copy)}</span>
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>
      <ExactDefinition check={check} copy={copy} />
    </article>
  );
}

export function ChecklistView({ questions }: { questions: readonly Check[] }) {
  const copy = useCopy();
  const locale = useLocale();
  const verdictQuestions = questions.filter((check) => check.type !== "choice" || check.citeFor === undefined);
  const sourceQuestions = questions.filter((check) => check.type === "choice" && check.citeFor !== undefined);
  const siteQuestions = verdictQuestions.filter((check) => !asksWhenArticle(check));
  const bodyQuestions = verdictQuestions.filter(asksWhenArticle);

  return (
    <section className="checklist-section">
      <header className="checklist-heading">
        <div>
          <h2 className="page-title">{copy.checklistTitle}</h2>
          <p className="lede">{copy.checklistHelp}</p>
        </div>
        <p className="checklist-counts">{copy.checklistCounts(verdictQuestions.length, sourceQuestions.length)}</p>
      </header>
      <div className="question-text-card">
        <h3>{copy.questionText}</h3>
        <p>{copy.definitionLanguage}</p>
      </div>
      <h3 className="checklist-group-title">{copy.site} · {copy.questionCount(siteQuestions.length)}</h3>
      {siteQuestions.map((check) => <VerdictQuestion check={check} copy={copy} key={check.id} />)}
      <h3 className="checklist-group-title">{copy.body} · {copy.questionCount(bodyQuestions.length)}</h3>
      {bodyQuestions.map((check) => <VerdictQuestion check={check} copy={copy} key={check.id} />)}
      <details className="reference-question-group">
        <summary>{copy.referenceQuestions} · {copy.sourceQuestionCount(sourceQuestions.length)}</summary>
        <p className="help">{copy.referenceQuestionsHelp}</p>
        {sourceQuestions.map((check) => {
          const parentId = check.type === "choice" ? check.citeFor : undefined;
          return (
            <article className="checklist-item" key={check.id}>
              <h3>{copy.sourceQuestionFor(questionLabel(parentId ?? "", locale))}</h3>
              <ExactDefinition check={check} copy={copy} />
            </article>
          );
        })}
      </details>
    </section>
  );
}
