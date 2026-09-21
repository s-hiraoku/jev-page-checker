import type { ItemResult } from "../lib/checkkit.js";
import { questionLabel } from "../lib/labels.js";
import { AnswerView, VerdictChip } from "./bits.js";
import { useCopy, useLocale } from "./useLocale.js";

export function ItemList({
  items,
  compact = false,
  siteIds,
  bodyIds,
}: {
  items: readonly ItemResult[];
  compact?: boolean;
  siteIds: readonly string[];
  bodyIds: readonly string[];
}) {
  const copy = useCopy();
  if (siteIds.length === 0 && bodyIds.length === 0) {
    return <ResultTable items={items} compact={compact} />;
  }
  return (
    <>
      <ResultGroup title={copy.site} items={items.filter((item) => siteIds.includes(item.id))} compact={compact} />
      <ResultGroup title={copy.body} items={items.filter((item) => bodyIds.includes(item.id))} compact={compact} />
    </>
  );
}

function ResultGroup({
  title,
  items,
  compact,
}: {
  title: string;
  items: readonly ItemResult[];
  compact: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="result-group">
      <div className="result-group-head">{title}</div>
      <ResultTable items={items} compact={compact} />
    </section>
  );
}

function ResultTable({ items, compact }: { items: readonly ItemResult[]; compact: boolean }) {
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
        {items.map((item) => (
          <tr key={item.id}>
            <th scope="row">
              {questionLabel(item.id, locale)}
              {compact ? null : <p className="reason">{item.reason}</p>}
            </th>
            <td>
              <VerdictChip verdict={item.verdict} />
            </td>
            <td>
              <AnswerView id={item.id} answer={item.answer} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
