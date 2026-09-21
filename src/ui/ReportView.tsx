import { bodySendKind, worstVerdict } from "../lib/groups.js";
import { TEXT_CHUNKED_NOTICE, TEXT_TRUNCATED_NOTICE } from "../lib/labels.js";
import type { StoredRecord } from "../lib/session.js";
import { ItemList } from "./ItemList.js";
import { Lane } from "./bits.js";
import { ResultRadars } from "./RadarChart.js";

export function ReportView({ record, compact = false }: { record: StoredRecord; compact?: boolean }) {
  const inspection = record.report.inspection;
  const siteIds = inspection?.siteQuestionIds ?? [];
  const bodyIds = inspection?.bodyQuestionIds ?? [];
  const site = worstVerdict(record.report.items, siteIds);
  const page = worstVerdict(record.report.items, bodyIds);
  const sendKind = bodySendKind(inspection);
  return (
    <div className="report">
      <div className="lanes">
        <Lane title="サイト" verdict={site} />
        <Lane title="本文" verdict={page} />
      </div>
      {sendKind === "unread" ? (
        <p className="notice" style={{ marginTop: 8 }}>
          {TEXT_TRUNCATED_NOTICE}
        </p>
      ) : null}
      {sendKind === "chunked" ? (
        <p className="help" style={{ marginTop: 8 }}>
          {TEXT_CHUNKED_NOTICE}（{inspection?.windowCount} 窓）
        </p>
      ) : null}
      <ResultRadars
        key={record.id}
        items={record.report.items}
        compact={compact}
        siteQuestionIds={siteIds}
        bodyQuestionIds={bodyIds}
      />
      <table className="meta-table">
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
                  {sendKind === "unread" ? " / 切れ残りあり" : sendKind === "chunked" ? ` / ${inspection?.windowCount} 窓` : ""}
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
