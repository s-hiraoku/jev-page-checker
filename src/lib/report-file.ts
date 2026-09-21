import { copyFor } from "./copy.js";
import { formatCheckedAt } from "./format.js";
import { basisLabel, questionLabel, VERDICT_LABELS } from "./labels.js";
import type { ResolvedLocale } from "./locale.js";
import type { StoredRecord } from "./session.js";

function kindName(kind: StoredRecord["snapshot"]["pageKind"], locale: ResolvedLocale): string {
  const copy = copyFor(locale);
  return kind === "portal" ? copy.kindListing : copy.kindArticle;
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
    `${copy.published}: ${snapshot.publishedAt || copy.absent}`,
    `${copy.pageKindLabel}: ${kindName(snapshot.pageKind, locale)}`,
    `${copy.hosts}: ${hosts}`,
    `${copy.wordCountLabel}: ${snapshot.wordCount}`,
    "",
  ];
  for (const item of record.report.items) {
    const basis = basisLabel(item.id, item.answer, locale, item.basis?.trim() ?? "");
    lines.push(`${questionLabel(item.id, locale)}: ${VERDICT_LABELS[item.verdict]}`);
    if (basis) lines.push(basis);
    if (item.cite) lines.push(item.cite);
    lines.push("");
  }
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
