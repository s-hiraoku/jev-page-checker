import { copyFor } from "./copy.js";
import { formatCheckedAt } from "./format.js";
import { bodySendKind } from "./groups.js";
import { basisEntries, choiceLabel, questionLabel, verdictRemark } from "./labels.js";
import { citeSource, displayCharacterRange } from "./report-evidence.js";
import { CATEGORY_RUBRICS, type ContentCategoryId } from "./category-rubrics.js";
import { isSiteTypeId, siteTypeLabel } from "./site-type.js";
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

function answerLines(id: string, answer: JevAnswer | undefined, locale: ResolvedLocale, definitionVersion?: number): string[] {
  if (answer === undefined) return [];
  const copy = copyFor(locale);
  if (answer.type === "noul") return [`${copy.answerProbability}: ${percentage(answer.noul, locale)}`];
  if (answer.type === "choice") {
    return [
      `${copy.answerSelection}: ${choiceLabel(id, answer.choice, locale, definitionVersion)}`,
      `${copy.answerConfidence}: ${percentage(answer.confidence, locale)}`,
      `${copy.probabilityDetails}: ${Object.entries(answer.probabilities)
        .sort((left, right) => right[1] - left[1])
        .map(([key, value]) => `${choiceLabel(id, key, locale, definitionVersion)} ${percentage(value, locale)}`)
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

function siteTypeLines(record: StoredRecord, locale: ResolvedLocale): string[] {
  const siteType = record.report.siteType;
  if (siteType === undefined) return [];
  const copy = copyFor(locale);
  if (siteType.status === "classified" && siteType.id !== undefined && isSiteTypeId(siteType.id)) {
    return [`${copy.siteTypeTitle}: ${siteTypeLabel(siteType.id, locale)}`];
  }
  const lines = [`${copy.siteTypeTitle}: ${copy.siteTypeReview}`];
  const reason = siteType.reasonCode !== undefined && Object.hasOwn(copy.siteTypeReasons, siteType.reasonCode)
    ? copy.siteTypeReasons[siteType.reasonCode as keyof typeof copy.siteTypeReasons]
    : siteType.reason;
  if (reason) lines.push(`${copy.classificationReason}: ${reason}`);
  return lines;
}

function classificationLines(record: StoredRecord, locale: ResolvedLocale): string[] {
  const copy = copyFor(locale);
  const classification = record.report.classification;
  if (classification === undefined) return [`${copy.classificationTitle}: ${copy.classificationOld}`];
  const category = (id: string) => CATEGORY_RUBRICS[id as ContentCategoryId]?.label[locale] ?? id;
  const source = (id: string) => {
    switch (id) {
      case "title": return copy.sourceTitle;
      case "metaDescription": return copy.sourceDescription;
      case "body": return copy.sourceBody;
      case "siteName": return copy.sourceSiteName;
      case "author": return copy.sourceAuthor;
      default: return copy.sourcePage;
    }
  };
  const reason = classification.reasonCode !== undefined && Object.hasOwn(copy.classificationReasons, classification.reasonCode)
    ? copy.classificationReasons[classification.reasonCode as keyof typeof copy.classificationReasons]
    : classification.reason;
  const lines = [copy.classificationTitle];
  if (classification.status === "review") lines.push(`${copy.verdict}: ${copy.classificationStatusReview}`);
  if (classification.status === "not_applicable") lines.push(`${copy.verdict}: ${copy.classificationStatusNotApplicable}`);
  if (classification.primary) lines.push(`${copy.classificationPrimary}: ${category(classification.primary)}`);
  if (classification.secondary) lines.push(`${copy.classificationSecondary}: ${category(classification.secondary)}`);
  if (classification.evidence) {
    lines.push(`${copy.classificationEvidence} (${source(classification.evidence.source)}): ${classification.evidence.text}`);
  }
  if (reason) lines.push(`${copy.classificationReason}: ${reason}`);
  if (classification.confidence !== undefined) lines.push(`${copy.classificationConfidence}: ${percentage(classification.confidence, locale)}`);
  if (classification.secondaryConfidence !== undefined) {
    lines.push(`${copy.classificationSecondary} · ${copy.classificationConfidence}: ${percentage(classification.secondaryConfidence, locale)}`);
  }
  if (classification.confidence !== undefined || classification.secondaryConfidence !== undefined) lines.push(copy.classificationConfidenceHelp);
  return lines;
}

export function reportFilename(record: StoredRecord): string {
  const host = record.snapshot.hostname.replace(/[^a-zA-Z0-9.-]+/g, "") || "page";
  const day = record.createdAt.slice(0, 10);
  return `jev-audit-${host}-${day}.txt`;
}

export function reportDocument(record: StoredRecord, locale: ResolvedLocale): string {
  const copy = copyFor(locale);
  const snapshot = record.snapshot;
  const definitionVersion = record.report.definition?.version;
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
    ...siteTypeLines(record, locale),
    ...classificationLines(record, locale),
    "",
  ];
  for (const item of record.report.items) {
    lines.push(questionLabel(item.id, locale, definitionVersion));
    lines.push(`${copy.verdict}: ${copy.verdictLabels[item.verdict]}`);
    lines.push(...answerLines(item.id, item.answer, locale, definitionVersion));
    const remark = verdictRemark(item.id, item.verdict, locale, definitionVersion);
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
