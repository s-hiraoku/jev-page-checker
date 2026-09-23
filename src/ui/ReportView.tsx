import type { Copy } from "../lib/copy.js";
import { bodySendKind, worstVerdict } from "../lib/groups.js";
import type { PageKind } from "../lib/page-state.js";
import type { StoredRecord } from "../lib/session.js";
import { ItemList } from "./ItemList.js";
import { Lane } from "./bits.js";
import { ResultRadars } from "./RadarChart.js";
import { useCopy } from "./useLocale.js";

function kindLabel(kind: PageKind, copy: Copy): string {
  return kind === "portal" ? copy.kindListing : copy.kindArticle;
}

function hostLine(hosts: readonly string[], copy: Copy): string {
  return hosts.length === 0 ? copy.noHosts : hosts.join(", ");
}

export function ReportView({ record, compact = false }: { record: StoredRecord; compact?: boolean }) {
  const copy = useCopy();
  const inspection = record.report.inspection;
  const siteIds = inspection?.siteQuestionIds ?? [];
  const bodyIds = inspection?.bodyQuestionIds ?? [];
  const site = worstVerdict(record.report.items, siteIds);
  const page = worstVerdict(record.report.items, bodyIds);
  const sendKind = bodySendKind(inspection);
  const snapshot = record.snapshot;
  return (
    <div className="report">
      <div className="lanes">
        <Lane title={copy.site} verdict={site} />
        <Lane title={copy.body} verdict={page} />
      </div>
      {sendKind === "unread" ? (
        <p className="notice">
          {copy.truncatedNotice}
        </p>
      ) : null}
      {sendKind === "chunked" ? (
        <p className="help chunked-note">
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
          <tr className="identity-title">
            <th>{copy.title}</th>
            <td>{record.snapshot.title || copy.untitled}</td>
          </tr>
          <tr className="identity-url">
            <th>URL</th>
            <td className="url">{record.snapshot.url}</td>
          </tr>
          <tr>
            <th>{copy.wordCountLabel}</th>
            <td>
              {snapshot.wordCount} {copy.words}
            </td>
          </tr>
          <tr>
            <th>{copy.https}</th>
            <td>{snapshot.isHttps ? copy.present : copy.absent}</td>
          </tr>
          <tr>
            <th>{copy.author}</th>
            <td>{snapshot.hasAuthor ? copy.present : copy.absent}</td>
          </tr>
          <tr>
            <th>{copy.published}</th>
            <td>{snapshot.publishedAt || copy.absent}</td>
          </tr>
          <tr>
            <th>{copy.pageKindLabel}</th>
            <td>{kindLabel(snapshot.pageKind, copy)}</td>
          </tr>
          <tr>
            <th>{copy.hosts}</th>
            <td>{hostLine(snapshot.outboundHosts, copy)}</td>
          </tr>
          {compact ? null : (
            <tr>
              <th>{copy.processing}</th>
              <td>
                Jev {record.report.timing.jevMs} ms / {copy.input} {record.report.usage.input_tokens} / {copy.output}{" "}
                {record.report.usage.output_tokens}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ItemList items={record.report.items} siteIds={siteIds} bodyIds={bodyIds} />
    </div>
  );
}
