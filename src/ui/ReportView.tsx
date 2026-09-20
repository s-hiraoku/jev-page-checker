import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "../lib/groups.js";
import type { StoredRecord } from "../lib/session.js";
import { ItemList } from "./ItemList.js";
import { Lane } from "./bits.js";

export function ReportView({ record, compact = false }: { record: StoredRecord; compact?: boolean }) {
  const site = worstVerdict(record.report.items, SITE_QUESTION_IDS);
  const page = worstVerdict(record.report.items, PAGE_QUESTION_IDS);
  return (
    <div>
      <div className="lanes">
        <Lane title="サイト" verdict={site} />
        <Lane title="本文" verdict={page} />
      </div>
      <table className="meta-table" style={{ marginTop: 8 }}>
        <tbody>
          <tr>
            <th>標題</th>
            <td>{record.snapshot.title || "（無題）"}</td>
          </tr>
          <tr>
            <th>URL</th>
            <td className="url">{record.snapshot.url}</td>
          </tr>
          {compact ? null : (
            <>
              <tr>
                <th>抽出</th>
                <td>
                  {record.snapshot.wordCount} 語 / 外部ホスト {record.snapshot.citationCount} / HTTPS{" "}
                  {record.snapshot.isHttps ? "あり" : "なし"} / 著者 {record.snapshot.hasAuthor ? "あり" : "なし"}
                </td>
              </tr>
              <tr>
                <th>処理</th>
                <td>
                  Jev {record.report.timing.jevMs} ms / 入力 {record.report.usage.input_tokens} / 出力{" "}
                  {record.report.usage.output_tokens}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      <ItemList items={record.report.items} compact={compact} />
    </div>
  );
}
