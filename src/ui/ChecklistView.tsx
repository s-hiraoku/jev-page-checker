import type { Check } from "../lib/checkkit.js";
import { instructionText, questionLabel } from "../lib/labels.js";
import { useCopy, useLocale } from "./useLocale.js";

function criteriaText(check: Check): string {
  if (check.type === "noul") {
    const criteria = check.criteria;
    if (criteria === undefined || criteria === null) return "";
    return [`true: ${JSON.stringify(criteria.true ?? "")}`, `false: ${JSON.stringify(criteria.false ?? "")}`].join("\n");
  }
  if (check.type === "choice") {
    return Object.entries(check.criteria)
      .map(([label, text]) => `${label} → ${check.options[label] ?? "review"}: ${JSON.stringify(text)}`)
      .join("\n");
  }
  return check.criteria.map((text, index) => `${index}: ${JSON.stringify(text)}`).join("\n");
}

function extras(check: Check): string {
  const lines: string[] = [`type: ${check.type}`];
  if (check.type === "noul" || check.type === "score") {
    if (check.passAt !== undefined) lines.push(`passAt: ${check.passAt}`);
    if (check.failAt !== undefined) lines.push(`failAt: ${check.failAt}`);
  }
  if (check.type !== "noul" && check.confidenceFloor !== undefined) lines.push(`confidenceFloor: ${check.confidenceFloor}`);
  if (check.applyWhen !== undefined) lines.push(`applyWhen: ${JSON.stringify(check.applyWhen)}`);
  return lines.join("\n");
}

export function ChecklistView({ questions }: { questions: readonly Check[] }) {
  const copy = useCopy();
  const locale = useLocale();
  return (
    <section>
      <h2 className="page-title">{copy.questions(questions.length)}</h2>
      <p className="help">{copy.wholeListAgain}</p>
      {questions.map((check) => (
        <article className="checklist-item" key={check.id}>
          <h3>
            {questionLabel(check.id, locale)} <span className="url">({check.id})</span>
          </h3>
          <p className="help">{instructionText(check)}</p>
          <pre>
            {extras(check)}
            {"\n"}
            {criteriaText(check)}
          </pre>
        </article>
      ))}
    </section>
  );
}
