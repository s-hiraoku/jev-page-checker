import type { ItemResult } from "../lib/checkkit.js";
import { questionLabel, verdictRemark } from "../lib/labels.js";
import type { ResolvedLocale } from "../lib/locale.js";
import type { PageSnapshot } from "../lib/page-state.js";
import { citeSource } from "../lib/report-evidence.js";
import { AnswerView, VerdictChip } from "./bits.js";
import { useCopy, useLocale } from "./useLocale.js";

export function ItemList({
  items,
  siteIds,
  bodyIds,
  snapshot,
  compact = false,
  definitionVersion,
}: {
  items: readonly ItemResult[];
  siteIds: readonly string[];
  bodyIds: readonly string[];
  snapshot: PageSnapshot;
  compact?: boolean;
  definitionVersion?: number;
}) {
  const copy = useCopy();
  if (siteIds.length === 0 && bodyIds.length === 0) {
    return <ResultGroup title={copy.pageChecks} items={items} snapshot={snapshot} compact={compact} definitionVersion={definitionVersion} />;
  }
  return (
    <div className="result-groups">
      <ResultGroup title={copy.site} items={items.filter((item) => siteIds.includes(item.id))} snapshot={snapshot} compact={compact} definitionVersion={definitionVersion} />
      <ResultGroup title={copy.body} items={items.filter((item) => bodyIds.includes(item.id))} snapshot={snapshot} compact={compact} definitionVersion={definitionVersion} />
    </div>
  );
}

function ResultGroup({
  title,
  items,
  snapshot,
  compact,
  definitionVersion,
}: {
  title: string;
  items: readonly ItemResult[];
  snapshot: PageSnapshot;
  compact: boolean;
  definitionVersion?: number;
}) {
  if (items.length === 0) return null;
  const copy = useCopy();
  const locale = useLocale();
  return (
    <section className="result-group" aria-label={title}>
      <h2 className="result-group-head">{title}</h2>
      <div className="result-cards">
        {items.map((item) => (
          <ResultCard key={item.id} item={item} snapshot={snapshot} locale={locale} compact={compact} definitionVersion={definitionVersion} />
        ))}
      </div>
      <p className="result-group-foot help">{copy.confidenceHelp}</p>
    </section>
  );
}

function ResultCard({ item, snapshot, locale, compact, definitionVersion }: { item: ItemResult; snapshot: PageSnapshot; locale: ResolvedLocale; compact: boolean; definitionVersion?: number }) {
  const copy = useCopy();
  const question = questionLabel(item.id, locale, definitionVersion);
  const source = item.cite ? citeSource(snapshot, item.cite, item.citeLocation) : null;
  const remark = verdictRemark(item.id, item.verdict, locale, definitionVersion);
  const selectedLabel = item.citeSource === "jev" ? copy.sourceSelected : item.citeSource === "related" ? copy.sourceRelated : "";
  const showReason =
    item.reason.length > 0 &&
    (item.reason.includes("cannot support pass") || item.reason.includes("synthesis error"));

  return (
    <article className={`result-card result-${item.verdict}`} aria-labelledby={`question-${item.id}`}>
      <div className="result-card-head">
        <h3 id={`question-${item.id}`}>{question}</h3>
        <VerdictChip verdict={item.verdict} />
      </div>
      <AnswerView id={item.id} answer={item.answer} definitionVersion={definitionVersion} />
      {remark ? <p className="result-remark">{remark}</p> : null}
      {item.cite ? (
        <figure className="evidence-quote">
          <figcaption>
            <span>{source ? copy[source.label] : copy.sourcePage}</span>
            {selectedLabel ? <span className="evidence-origin">{selectedLabel}</span> : null}
          </figcaption>
          <blockquote>{item.cite}</blockquote>
          {source?.target && !compact ? (
              <a
                className="evidence-link"
                href={`#${source.label === "sourceBody" ? `body-evidence-${item.id}` : source.target}`}
                onClick={() => {
                  if (source.label !== "sourceBody") document.getElementById("page-information")?.setAttribute("open", "");
                }}
              >
              {source.label === "sourceBody" ? copy.viewInBody : copy.viewInPageInfo}
            </a>
          ) : null}
        </figure>
      ) : null}
      {showReason ? <p className="reason">{item.reason}</p> : null}
    </article>
  );
}
