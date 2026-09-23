import type { PageSnapshot } from "./page-state.js";
import type { PageSpanSource } from "../../runner/spans.js";

export type CitationLabel =
  | "sourceTitle"
  | "sourceSiteName"
  | "sourceAuthor"
  | "sourceDescription"
  | "sourceBody"
  | "sourcePage";

export function displayCharacterRange(text: string, start: number, end: number): { start: number; end: number } {
  return {
    start: [...text.slice(0, start)].length,
    end: [...text.slice(0, end)].length,
  };
}

export function citeSource(snapshot: PageSnapshot, cite: string, location?: PageSpanSource): { label: CitationLabel; target: string | null } {
  if (location !== undefined) {
    if (location === "body") return { label: "sourceBody", target: "body-evidence" };
    const label: Record<Exclude<PageSpanSource, "body">, CitationLabel> = {
      title: "sourceTitle",
      siteName: "sourceSiteName",
      author: "sourceAuthor",
      metaDescription: "sourceDescription",
    };
    return { label: label[location], target: `page-metadata-${location}` };
  }
  const fields: [keyof Pick<PageSnapshot, "title" | "siteName" | "author" | "metaDescription">, CitationLabel][] = [
    ["title", "sourceTitle"],
    ["siteName", "sourceSiteName"],
    ["author", "sourceAuthor"],
    ["metaDescription", "sourceDescription"],
  ];
  for (const [field, label] of fields) {
    const value = snapshot[field].trim();
    if (value && value.includes(cite.trim())) {
      return { label, target: `page-metadata-${field}` };
    }
  }
  if (snapshot.text.includes(cite)) return { label: "sourceBody", target: "body-evidence" };
  return { label: "sourcePage", target: null };
}
