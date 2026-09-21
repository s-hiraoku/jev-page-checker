import { bodySendKind, worstVerdict } from "../lib/groups.js";
import type { StoredRecord } from "../lib/session.js";
import { ItemList } from "./ItemList.js";
import { Lane } from "./bits.js";
import { ResultRadars } from "./RadarChart.js";
import { useCopy } from "./useLocale.js";

export function ReportView({ record, compact = false }: { record: StoredRecord; compact?: boolean }) {
  const copy = useCopy();
  const inspection = record.report.inspection;
  const siteIds = inspection?.siteQuestionIds ?? [];
  const bodyIds = inspection?.bodyQuestionIds ?? [];
  const site = worstVerdict(record.report.items, siteIds);
  const page = worstVerdict(record.report.items, bodyIds);
  const sendKind = bodySendKind(inspection);
  const leftover =
    sendKind === "unread" ? ` / ${copy.leftover}` : sendKind === "chunked" ? ` / ${copy.windows(inspection?.windowCount ?? 0)}` : "";
  return (
    <div className="report">
      <div className="lanes">
        <Lane title={copy.site} verdict={site} />
        <Lane title={copy.body} verdict={page} />
      </div>
      {sendKind === "unread" ? (
        <p className="notice" style={{ marginTop: 8 }}>
          {copy.truncatedNotice}
        </p>
      ) : null}
      {sendKind === "chunked" ? (
        <p className="help" style={{ marginTop: 8 }}>
          {copy.chunkedNotice} ({copy.windows(inspection?.windowCount ?? 0)})
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
            <th>{copy.title}</th>
            <td>{record.snapshot.title || copy.untitled}</td>
          </tr>
          <tr>
            <th>URL</th>
            <td className="url">{record.snapshot.url}</td>
          </tr>
          {compact ? null : (
            <>
              <tr>
                <th>{copy.extract}</th>
                <td>
                  {record.snapshot.wordCount} {copy.words} / {copy.outboundHosts} {record.snapshot.citationCount} / HTTPS{" "}
                  {record.snapshot.isHttps ? copy.present : copy.absent} / {copy.author}{" "}
                  {record.snapshot.hasAuthor ? copy.present : copy.absent}
                  {leftover}
                </td>
              </tr>
              <tr>
                <th>{copy.processing}</th>
                <td>
                  Jev {record.report.timing.jevMs} ms / {copy.input} {record.report.usage.input_tokens} / {copy.output}{" "}
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
