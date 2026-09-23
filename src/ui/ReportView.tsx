import type { Copy } from "../lib/copy.js";
import { bodySendKind, worstVerdict } from "../lib/groups.js";
import { formatCheckedAt } from "../lib/format.js";
import type { PageKind, PageSnapshot } from "../lib/page-state.js";
import type { ItemResult } from "../lib/checkkit.js";
import { CATEGORY_RUBRICS, type ContentCategoryId } from "../lib/category-rubrics.js";
import type { StoredRecord } from "../lib/session.js";
import { citeSource, displayCharacterRange } from "../lib/report-evidence.js";
import { ItemList } from "./ItemList.js";
import { Lane } from "./bits.js";
import { ResultRadars } from "./RadarChart.js";
import { useCopy, useLocale } from "./useLocale.js";

function kindLabel(kind: PageKind, copy: Copy): string {
  return kind === "portal" ? copy.kindListing : copy.kindArticle;
}

function hostLine(hosts: readonly string[], copy: Copy): string {
  return hosts.length === 0 ? copy.noHosts : hosts.join(", ");
}

function classificationCategory(id: string, locale: string): string {
  const rubric = CATEGORY_RUBRICS[id as ContentCategoryId];
  return rubric?.label[locale === "ja" ? "ja" : "en"] ?? id;
}

function classificationSource(source: string, copy: Copy): string {
  switch (source) {
    case "title": return copy.sourceTitle;
    case "metaDescription": return copy.sourceDescription;
    case "body": return copy.sourceBody;
    case "siteName": return copy.sourceSiteName;
    case "author": return copy.sourceAuthor;
    default: return copy.sourcePage;
  }
}

function classificationReason(code: string | undefined, reason: string | undefined, copy: Copy): string | undefined {
  if (code !== undefined && Object.hasOwn(copy.classificationReasons, code)) {
    return copy.classificationReasons[code as keyof typeof copy.classificationReasons];
  }
  return reason;
}

function ClassificationResult({ record, compact }: { record: StoredRecord; compact: boolean }) {
  const copy = useCopy();
  const locale = useLocale();
  const classification = record.report.classification;
  const reason = classificationReason(classification?.reasonCode, classification?.reason, copy);
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
  return (
    <section className="classification-result" id="content-classification" aria-labelledby="classification-heading">
      <h2 id="classification-heading">{copy.classificationTitle}</h2>
      {!classification ? <p>{copy.classificationOld}</p> : (
        <>
          {classification.status === "review" ? <p className="classification-status review">{copy.classificationStatusReview}</p> : null}
          {classification.status === "not_applicable" ? <p className="classification-status">{copy.classificationStatusNotApplicable}</p> : null}
          <dl className="classification-fields">
            {classification.primary ? <div><dt>{copy.classificationPrimary}</dt><dd>{classificationCategory(classification.primary, locale)}</dd></div> : null}
            {classification.secondary ? <div><dt>{copy.classificationSecondary}</dt><dd>{classificationCategory(classification.secondary, locale)}</dd></div> : null}
          </dl>
          {classification.evidence ? (
            <figure className="classification-evidence">
              <figcaption>{copy.classificationEvidence} · {classificationSource(classification.evidence.source, copy)}</figcaption>
              <blockquote>{classification.evidence.text}</blockquote>
            </figure>
          ) : null}
          {reason ? <p className="classification-reason">{copy.classificationReason}: {reason}</p> : null}
          {!compact && classification.confidence !== undefined ? (
            <dl className="classification-fields">
              <div><dt>{copy.classificationConfidence}</dt><dd>{percent(classification.confidence)}</dd></div>
              {classification.secondaryConfidence !== undefined ? <div><dt>{copy.classificationSecondary} · {copy.classificationConfidence}</dt><dd>{percent(classification.secondaryConfidence)}</dd></div> : null}
            </dl>
          ) : null}
          {!compact && (classification.confidence !== undefined || classification.secondaryConfidence !== undefined) ? (
            <p className="help classification-confidence-help">{copy.classificationConfidenceHelp}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function HighlightedBody({ text, items, snapshot }: { text: string; items: readonly ItemResult[]; snapshot: PageSnapshot }) {
  const citations = items.flatMap((item) => {
    if (!item.cite || citeSource(snapshot, item.cite, item.citeLocation).label !== "sourceBody") return [];
    const start = text.indexOf(item.cite);
    return start < 0 ? [] : [{ start, end: start + item.cite.length, id: `body-evidence-${item.id}` }];
  });
  const boundaries = [...new Set([0, text.length, ...citations.flatMap(({ start, end }) => [start, end])])].sort((a, b) => a - b);
  const anchors = new Map<number, string[]>();
  for (const citation of citations) anchors.set(citation.start, [...(anchors.get(citation.start) ?? []), citation.id]);
  return (
    <p className="body-copy-text">
      {boundaries.slice(0, -1).map((start, index) => {
        const end = boundaries[index + 1] ?? text.length;
        const value = text.slice(start, end);
        const ids = anchors.get(start) ?? [];
        const active = citations.some((citation) => citation.start < end && citation.end > start);
        return (
          <span className="body-copy-part" key={`${start}-${end}`}>
            {ids.map((id) => <span className="evidence-anchor" id={id} key={id} />)}
            {active ? <mark>{value}</mark> : value}
          </span>
        );
      })}
    </p>
  );
}

function PageInformation({ snapshot, copy }: { snapshot: PageSnapshot; copy: Copy }) {
  const fields = [
    ["title", copy.title, snapshot.title || copy.untitled],
    ["siteName", copy.siteName, snapshot.siteName || copy.absent],
    ["author", copy.author, snapshot.author || copy.absent],
    ["metaDescription", copy.pageDescription, snapshot.metaDescription || copy.absent],
    ["publishedAt", copy.published, snapshot.publishedAt || copy.absent],
    ["language", copy.language, snapshot.language || copy.absent],
    ["pageKind", copy.pageKindLabel, kindLabel(snapshot.pageKind, copy)],
    ["https", copy.https, snapshot.isHttps ? copy.present : copy.absent],
    ["wordCount", copy.wordCountLabel, `${snapshot.wordCount} ${copy.words}`],
    ["textLength", copy.bodyLengthLabel, copy.bodyLength([...snapshot.text].length)],
    ["linkCount", copy.links, String(snapshot.linkCount)],
    ["outboundHosts", copy.hosts, hostLine(snapshot.outboundHosts, copy)],
  ] as const;
  return (
    <details className="report-disclosure page-info" id="page-information">
      <summary>{copy.pageInfo}</summary>
      <p className="help">{copy.pageInfoHelp}</p>
      <dl className="metadata-list">
        {fields.map(([key, label, value]) => (
          <div id={`page-metadata-${key}`} className="metadata-row" key={key}>
            <dt>{label}</dt><dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function ReviewedBody({ record, compact, label }: { record: StoredRecord; compact: boolean; label: string }) {
  const copy = useCopy();
  if (compact) return null;
  const { snapshot } = record;
  const inspection = record.report.inspection;
  const windows = inspection?.windows;
  const showWindowRanges = inspection?.windowCount !== undefined && inspection.windowCount > 1;
  return (
    <section className="reviewed-body" id="body-evidence">
      <details className="report-disclosure body-disclosure" open>
        <summary>
          <span>{label}</span>
          <span className="body-length">{copy.bodyLength([...snapshot.text].length)}</span>
        </summary>
        <p className="help">{copy.bodyTextHelp}</p>
        {snapshot.text ? <HighlightedBody text={snapshot.text} items={record.report.items} snapshot={snapshot} /> : <p>{copy.noBodyText}</p>}
      </details>
      {showWindowRanges ? (
        <details className="report-disclosure window-disclosure">
          <summary>{copy.bodyWindows} · {copy.windows(inspection.windowCount)}</summary>
          <p className="help">{copy.windowHelp}</p>
          {windows?.length ? windows.map(({ start, end }, index) => {
            const range = displayCharacterRange(snapshot.text, start, end);
            return (
              <details className="window-item" key={`${start}-${end}`}>
                <summary>{copy.bodyWindow(index + 1, range.start, range.end)}</summary>
                <p className="body-copy-text">{snapshot.text.slice(start, end)}</p>
              </details>
            );
          }) : <p className="help">{copy.windowRangesUnavailable}</p>}
        </details>
      ) : null}
    </section>
  );
}

export function ReportView({ record, compact = false }: { record: StoredRecord; compact?: boolean }) {
  const copy = useCopy();
  const locale = useLocale();
  const inspection = record.report.inspection;
  const siteIds = inspection?.siteQuestionIds ?? [];
  const bodyIds = inspection?.bodyQuestionIds ?? [];
  const siteVerdict = worstVerdict(record.report.items, siteIds);
  const bodyVerdict = worstVerdict(record.report.items, bodyIds);
  const sendKind = bodySendKind(inspection);
  const snapshot = record.snapshot;
  const sentLabel = sendKind === "unread" ? copy.sentUnread : sendKind === "chunked" ? copy.sentChunked : copy.sentBody;

  return (
    <div className={`report${compact ? " report-compact" : ""}`}>
      <header className="report-heading">
        <h1>{snapshot.title || copy.untitled}</h1>
        <a className="report-url" href={snapshot.url} target="_blank" rel="noreferrer">{snapshot.url}</a>
        {!compact ? <p className="report-time">{copy.checkedAt} · {formatCheckedAt(record.createdAt, locale)}</p> : null}
      </header>
      <div className="lanes">
        <Lane title={copy.site} verdict={siteVerdict} />
        <Lane title={copy.body} verdict={bodyVerdict} />
      </div>
      <ClassificationResult record={record} compact={compact} />
      <section className="report-charts" aria-label={copy.chartDetails}>
        <h2>{copy.chartDetails}</h2>
        <ResultRadars
          key={record.id}
          items={record.report.items}
          compact={compact}
          siteQuestionIds={siteIds}
          bodyQuestionIds={bodyIds}
        />
      </section>
      {sendKind === "unread" ? <p className="notice">{copy.truncatedNotice}</p> : null}
      {sendKind === "chunked" ? <p className="help chunked-note">{copy.chunkedNotice} {copy.synthesisHelp}</p> : null}
      <p className="help result-help">{copy.resultHelp}</p>
      <ItemList items={record.report.items} siteIds={siteIds} bodyIds={bodyIds} snapshot={snapshot} compact={compact} />
      <ReviewedBody record={record} compact={compact} label={sentLabel} />
      {!compact ? <PageInformation snapshot={snapshot} copy={copy} /> : null}
      {!compact ? (
        <details className="report-disclosure processing-details">
          <summary>{copy.technicalDetails}</summary>
          <dl className="metadata-list">
            <div className="metadata-row"><dt>{copy.processing}</dt><dd>Jev {record.report.timing.jevMs} ms</dd></div>
            <div className="metadata-row"><dt>{copy.input}</dt><dd>{record.report.usage.input_tokens}</dd></div>
            <div className="metadata-row"><dt>{copy.output}</dt><dd>{record.report.usage.output_tokens}</dd></div>
            <div className="metadata-row"><dt>{copy.extractionStatus}</dt><dd>{snapshot.textTruncated ? copy.incomplete : copy.complete}</dd></div>
          </dl>
        </details>
      ) : null}
    </div>
  );
}
