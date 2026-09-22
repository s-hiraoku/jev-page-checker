import type { ItemResult } from "../lib/checkkit.js";
import { evidenceReadout, questionLabel } from "../lib/labels.js";
import { AnswerView, VerdictChip } from "./bits.js";
import { useCopy, useLocale } from "./useLocale.js";

export function ItemList({
  items,
  siteIds,
  bodyIds,
}: {
  items: readonly ItemResult[];
  siteIds: readonly string[];
  bodyIds: readonly string[];
}) {
  const copy = useCopy();
  if (siteIds.length === 0 && bodyIds.length === 0) {
    return <ResultTable items={items} />;
  }
  return (
    <>
      <ResultGroup title={copy.site} items={items.filter((item) => siteIds.includes(item.id))} />
      <ResultGroup title={copy.body} items={items.filter((item) => bodyIds.includes(item.id))} />
    </>
  );
}

function ResultGroup({ title, items }: { title: string; items: readonly ItemResult[] }) {
  if (items.length === 0) return null;
  return (
    <section className="result-group">
      <div className="result-group-head">{title}</div>
      <ResultTable items={items} />
    </section>
  );
}

function ResultTable({ items }: { items: readonly ItemResult[] }) {
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
          const readout = evidenceReadout(item.id, item.verdict, locale, item.cite ?? "");
          const showReason =
            item.reason.length > 0 &&
            (item.reason.includes("cannot support pass") || item.reason.includes("synthesis error"));
          return (
            <tr key={item.id}>
              <th scope="row">
                {questionLabel(item.id, locale)}
                <table className="evidence-table">
                  <tbody>
                    {readout.remark ? (
                      <tr>
                        <th scope="row">{copy.remark}</th>
                        <td>{readout.remark}</td>
                      </tr>
                    ) : null}
                    {readout.sentence ? (
                      <tr>
                        <th scope="row">{copy.grounds}</th>
                        <td>{readout.sentence}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
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
