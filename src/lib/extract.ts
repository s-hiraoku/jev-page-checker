import { bodyCollectLimit } from "./body-windows.js";
import type { PageSnapshot } from "./page-state.js";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "ASIDE", "SVG", "IFRAME", "CANVAS"]);

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g;

/** A headline is shorter than a short sentence. Listings are mostly headlines. */
const LISTING_MAX_WORDS_PER_LINK = 12;
/** One or two links do not make a directory. */
const LISTING_MIN_LINKS = 8;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const spaced = trimmed.split(/\s+/).filter(Boolean).length;
  const cjk = (trimmed.match(CJK) ?? []).length;
  return spaced + Math.floor(cjk / 2);
}

/** Listing vs one text. Do not special-case a host or path. */
export function classifyPageKind(articleCount: number, linkCount: number, words: number): "article" | "portal" {
  if (articleCount >= 1) return "article";
  if (linkCount >= LISTING_MIN_LINKS && words / Math.max(linkCount, 1) < LISTING_MAX_WORDS_PER_LINK) return "portal";
  return "article";
}

export function collectOutbound(hrefs: readonly string[], pageHost: string): { hosts: string[]; citationCount: number } {
  const hosts = new Set<string>();
  for (const href of hrefs) {
    try {
      const url = new URL(href);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (url.hostname === pageHost || url.hostname.endsWith(`.${pageHost}`)) continue;
      hosts.add(url.hostname);
    } catch {
      continue;
    }
  }
  return { hosts: [...hosts].sort(), citationCount: hosts.size };
}

export function metaContent(doc: ParentNode, names: readonly string[]): string {
  for (const name of names) {
    const element = doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    const value = element?.getAttribute("content")?.trim();
    if (value) return value;
  }
  return "";
}

export function collectText(root: ParentNode, maxChars: number): { text: string; truncated: boolean } {
  const parts: string[] = [];
  let length = 0;
  let truncated = false;
  const walk = (node: Node): void => {
    if (truncated) return;
    if (node.nodeType === 3) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (!text) return;
      if (length >= maxChars) {
        truncated = true;
        return;
      }
      if (length > 0) length += 1;
      length += text.length;
      parts.push(text);
      if (length > maxChars) truncated = true;
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (SKIP_TAGS.has(element.tagName)) return;
    if (element.getAttribute("aria-hidden") === "true") return;
    for (const child of element.childNodes) walk(child);
  };
  walk(root as unknown as Node);
  return { text: parts.join(" ").slice(0, maxChars), truncated };
}

export function extractSnapshot(
  doc: Document,
  loc: Pick<Location, "href" | "hostname" | "protocol">,
  minWords: number,
  now = (): string => new Date().toISOString(),
  collectLimit = bodyCollectLimit(),
): PageSnapshot {
  const author = metaContent(doc, ["author", "article:author", "byl", "citation_author"]);
  const publishedAt = metaContent(doc, ["article:published_time", "date", "pubdate", "dc.date"]);
  const siteName = metaContent(doc, ["og:site_name", "application-name"]);
  const metaDescription = metaContent(doc, ["description", "og:description"]);
  const articleCount = doc.querySelectorAll("article").length;
  const root = doc.querySelector("article, [role=main], main") ?? doc.body;
  const hrefs = [...(root ?? doc).querySelectorAll("a[href]")].map((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    try {
      return new URL(href, loc.href).href;
    } catch {
      return "";
    }
  });
  const { hosts, citationCount } = collectOutbound(hrefs, loc.hostname);
  const { text, truncated } = collectText(root ?? doc.body, collectLimit);
  const words = wordCount(text);
  const pageKind = classifyPageKind(articleCount, hrefs.length, words);
  return {
    url: loc.href,
    hostname: loc.hostname,
    protocol: loc.protocol,
    title: (doc.title ?? "").trim(),
    metaDescription,
    author,
    publishedAt,
    siteName,
    language: doc.documentElement.getAttribute("lang") ?? "",
    isHttps: loc.protocol === "https:",
    hasAuthor: author.length > 0,
    hasPublishedAt: publishedAt.length > 0,
    hasBody: words >= minWords,
    hasArticle: pageKind === "article" && words >= minWords,
    pageKind,
    linkCount: hrefs.length,
    wordCount: words,
    citationCount,
    outboundHosts: hosts,
    text,
    textTruncated: truncated,
    extractedAt: now(),
  };
}
