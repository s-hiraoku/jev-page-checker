import type { EntryType } from "@typesafe-ai/sdk";

export type PageKind = "article" | "portal";

export interface PageSnapshot {
  url: string;
  hostname: string;
  protocol: string;
  title: string;
  metaDescription: string;
  author: string;
  publishedAt: string;
  siteName: string;
  language: string;
  isHttps: boolean;
  hasAuthor: boolean;
  hasPublishedAt: boolean;
  hasBody: boolean;
  hasArticle: boolean;
  pageKind: PageKind;
  linkCount: number;
  wordCount: number;
  citationCount: number;
  outboundHosts: string[];
  text: string;
  extractedAt: string;
}

export function snapshotFingerprint(snapshot: Pick<PageSnapshot, "url" | "text">): string {
  return `${snapshot.url}\n${snapshot.text}`;
}

export function snapshotToState({ extractedAt: _extractedAt, ...state }: PageSnapshot): EntryType {
  return state;
}

export function isInspectableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
