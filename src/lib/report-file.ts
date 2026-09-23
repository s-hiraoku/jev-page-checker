import { copyFor } from "./copy.js";
import { formatCheckedAt } from "./format.js";
import { bodySendKind } from "./groups.js";
import { basisEntries, choiceLabel, questionLabel, verdictRemark } from "./labels.js";
import { citeSource, displayCharacterRange } from "./report-evidence.js";
import type { ResolvedLocale } from "./locale.js";
import type { StoredRecord } from "./session.js";
import type { JevAnswer } from "./checkkit.js";

function kindName(kind: StoredRecord["snapshot"]["pageKind"], locale: ResolvedLocale): string {
  const copy = copyFor(locale);
  return kind === "portal" ? copy.kindListing : copy.kindArticle;
}

function percentage(value: number, locale: ResolvedLocale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function answerLines(id: string, answer: JevAnswer | undefined, locale: ResolvedLocale): string[] {
  if (answer === undefined) return [];
  const copy = copyFor(locale);
  if (answer.type === "noul") return [`${copy.answerProbability}: ${percentage(answer.noul, locale)}`];
  if (answer.type === "choice") {
    return [
      `${copy.answerSelection}: ${choiceLabel(id, answer.choice, locale)}`,
      `${copy.answerConfidence}: ${percentage(answer.confidence, locale)}`,
      `${copy.probabilityDetails}: ${Object.entries(answer.probabilities)
        .sort((left, right) => right[1] - left[1])
        .map(([key, value]) => `${choiceLabel(id, key, locale)} ${percentage(value, locale)}`)
        .join(" / ")}`,
    ];
  }
  const rubricLabels = new Map(basisEntries(id, locale).map((entry) => [entry.key, entry.text]));
  return [
    `${copy.score}: ${answer.score.toFixed(2)}`,
    `${copy.scoreConfidence}: ${percentage(answer.confidence, locale)}`,
    `${copy.scoreDistribution}: ${Object.entries(answer.probabilities)
      .sort((left, right) => Number(left[0]) - Number(right[0]))
      .map(([key, value]) => `${rubricLabels.get(key) ?? (answer.legend as Record<string, string>)[key] ?? key} ${percentage(value, locale)}`)
      .join(" / ")}`,
  ];
}

export function reportFilename(record: StoredRecord): string {
  const host = record.snapshot.hostname.replace(/[^a-zA-Z0-9.-]+/g, "") || "page";
  const day = record.createdAt.slice(0, 10);
  return `jev-audit-${host}-${day}.txt`;
}

export function reportDocument(record: StoredRecord, locale: ResolvedLocale): string {
  const copy = copyFor(locale);
  const snapshot = record.snapshot;
  const hosts = snapshot.outboundHosts.length === 0 ? copy.noHosts : snapshot.outboundHosts.join(", ");
  const lines = [
    snapshot.title || copy.untitled,
    snapshot.url,
    `${copy.checkedAt}: ${formatCheckedAt(record.createdAt, locale)}`,
    `${copy.siteName}: ${snapshot.siteName || copy.absent}`,
    `${copy.author}: ${snapshot.author || copy.absent}`,
    `${copy.pageDescription}: ${snapshot.metaDescription || copy.absent}`,
    `${copy.published}: ${snapshot.publishedAt || copy.absent}`,
    `${copy.pageKindLabel}: ${kindName(snapshot.pageKind, locale)}`,
    `${copy.https}: ${snapshot.isHttps ? copy.present : copy.absent}`,
    `${copy.language}: ${snapshot.language || copy.absent}`,
    `${copy.wordCountLabel}: ${snapshot.wordCount} ${copy.words}`,
    `${copy.bodyLengthLabel}: ${copy.bodyLength([...snapshot.text].length)}`,
    `${copy.links}: ${snapshot.linkCount}`,
    `${copy.hosts}: ${hosts}`,
    "",
  ];
  for (const item of record.report.items) {
    lines.push(questionLabel(item.id, locale));
    lines.push(`${copy.verdict}: ${copy.verdictLabels[item.verdict]}`);
    lines.push(...answerLines(item.id, item.answer, locale));
    const remark = verdictRemark(item.id, item.verdict, locale);
    if (remark) lines.push(`${copy.remark}: ${remark}`);
    if (item.cite) {
      const source = citeSource(snapshot, item.cite, item.citeLocation);
      lines.push(`${copy.grounds} (${copy[source.label]}${item.citeSource === "jev" ? `; ${copy.sourceSelected}` : item.citeSource === "related" ? `; ${copy.sourceRelated}` : ""}): ${item.cite}`);
    }
    lines.push("");
  }

  const inspection = record.report.inspection;
  if (inspection?.windowCount && inspection.windowCount > 1) {
    lines.push(copy.bodyWindows);
    for (const [index, window] of (inspection.windows ?? []).entries()) {
      const range = displayCharacterRange(snapshot.text, window.start, window.end);
      lines.push(copy.bodyWindow(index + 1, range.start, range.end));
      lines.push(snapshot.text.slice(window.start, window.end));
      lines.push("");
    }
    if (!inspection.windows?.length) lines.push(copy.windowRangesUnavailable, "");
  }
  lines.push(`${bodySendKind(inspection) === "unread" ? copy.sentUnread : bodySendKind(inspection) === "chunked" ? copy.sentChunked : copy.sentBody}`);
  lines.push(snapshot.text);
  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
