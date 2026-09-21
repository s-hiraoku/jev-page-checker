import type { ItemResult } from "../lib/checkkit.js";
import type { PageSnapshot } from "../lib/page-state.js";
import { basisLabel, questionLabel } from "../lib/labels.js";
import { AnswerView, VerdictChip } from "./bits.js";
import { useCopy, useLocale } from "./useLocale.js";

export function ItemList({
  items,
  siteIds,
  bodyIds,
  snapshot,
}: {
  items: readonly ItemResult[];
  siteIds: readonly string[];
  bodyIds: readonly string[];
  snapshot?: Pick<PageSnapshot, "author" | "siteName">;
}) {
  const copy = useCopy();
  if (siteIds.length === 0 && bodyIds.length === 0) {
    return <ResultTable items={items} snapshot={snapshot} />;
  }
  return (
    <>
      <ResultGroup title={copy.site} items={items.filter((item) => siteIds.includes(item.id))} snapshot={snapshot} />
      <ResultGroup title={copy.body} items={items.filter((item) => bodyIds.includes(item.id))} snapshot={snapshot} />
    </>
  );
}

function ResultGroup({
  title,
  items,
  snapshot,
}: {
  title: string;
  items: readonly ItemResult[];
  snapshot?: Pick<PageSnapshot, "author" | "siteName">;
}) {
  if (items.length === 0) return null;
  return (
    <section className="result-group">
      <div className="result-group-head">{title}</div>
      <ResultTable items={items} snapshot={snapshot} />
    </section>
  );
}

function identitySpan(id: string, snapshot: Pick<PageSnapshot, "author" | "siteName"> | undefined): string {
  if (snapshot === undefined) return "";
  if (id !== "identifiable_publisher" && id !== "honest_identity") return "";
  return [snapshot.author, snapshot.siteName].filter((part) => part.length > 0).join(" · ");
}

function ResultTable({
  items,
  snapshot,
}: {
  items: readonly ItemResult[];
  snapshot?: Pick<PageSnapshot, "author" | "siteName">;
}) {
  const copy = useCopy();
  const locale = useLocale();
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>{copy.item}</th>
          <th>{copy.verdict}</th>
          <th>{copy.value}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const basis = basisLabel(item.id, item.answer, locale, item.basis?.trim() ?? "");
          const span = identitySpan(item.id, snapshot);
          const showReason =
            item.reason.length > 0 &&
            (basis.length === 0 || item.reason.includes("cannot support pass") || item.reason.includes("synthesis error"));
          return (
            <tr key={item.id}>
              <th scope="row">
                {questionLabel(item.id, locale)}
                {basis ? <p className="reason">{basis}</p> : null}
                {item.cite ? <p className="cite">{item.cite}</p> : null}
                {span ? <p className="cite">{span}</p> : null}
                {showReason ? <p className="reason">{item.reason}</p> : null}
              </th>
              <td>
                <VerdictChip verdict={item.verdict} />
              </td>
              <td>
                <AnswerView id={item.id} answer={item.answer} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
