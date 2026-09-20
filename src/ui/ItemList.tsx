import type { ItemResult } from "../lib/checkkit.js";
import { questionLabel } from "../lib/labels.js";
import { AnswerView, VerdictChip } from "./bits.js";

export function ItemList({ items, compact = false }: { items: readonly ItemResult[]; compact?: boolean }) {
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>項目</th>
          <th>判定</th>
          <th>測定値</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <th scope="row">
              {questionLabel(item.id)}
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
