import type { ItemResult } from "../lib/checkkit.js";
import { questionLabel } from "../lib/labels.js";
import { AnswerView, VerdictChip } from "./bits.js";
import { useCopy, useLocale } from "./useLocale.js";

export function ItemList({ items, compact = false }: { items: readonly ItemResult[]; compact?: boolean }) {
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
