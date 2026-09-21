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

const NAME_MAX = 80;
const NAME_MAX_WORDS = 8;

function collapsed(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isPlausibleName(text: string): boolean {
  if (text.length < 1 || text.length > NAME_MAX) return false;
  if (/^https?:\/\//i.test(text)) return false;
  return text.split(" ").filter(Boolean).length <= NAME_MAX_WORDS;
}

function firstPlausible(values: readonly string[]): string {
  for (const value of values) {
    const text = collapsed(value);
    if (isPlausibleName(text)) return text;
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function ldName(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = ldName(item);
      if (name) return name;
    }
    return "";
  }
  if (!isRecord(value)) return "";
  return ldName(value.name);
}

function collectJsonLd(node: unknown, authors: string[], publishers: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLd(item, authors, publishers);
    return;
  }
  if (!isRecord(node)) return;
  if (node.author !== undefined) {
    const name = ldName(node.author);
    if (name) authors.push(name);
  }
  if (node.publisher !== undefined) {
    const name = ldName(node.publisher);
    if (name) publishers.push(name);
  }
  if (node.isPartOf !== undefined) {
    const name = ldName(node.isPartOf);
    if (name) publishers.push(name);
  }
  if (node["@graph"] !== undefined) collectJsonLd(node["@graph"], authors, publishers);
}

function jsonLdIdentity(doc: Document): { author: string; publisher: string } {
  const authors: string[] = [];
  const publishers: string[] = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collectJsonLd(JSON.parse(script.textContent ?? ""), authors, publishers);
    } catch {
      continue;
    }
  }
  return { author: firstPlausible(authors), publisher: firstPlausible(publishers) };
}

function namedMeta(doc: ParentNode, names: readonly string[]): string {
  return firstPlausible(names.map((name) => metaContent(doc, [name])));
}

function visibleByline(doc: Document): string {
  const seen = new Set<Element>();
  const candidates: Element[] = [];
  const push = (elements: Iterable<Element>): void => {
    for (const element of elements) {
      if (seen.has(element)) continue;
      seen.add(element);
      candidates.push(element);
    }
  };
  push(doc.querySelectorAll('[rel="author"], [itemprop="author"] [itemprop="name"], [itemprop="author"], [itemprop="creator"]'));
  for (const root of doc.querySelectorAll("article, header, [role=main], main, aside")) {
    push(root.querySelectorAll('[class*="byline" i], [class*="author" i], [id*="author" i], [id*="byline" i]'));
  }
  for (const element of candidates) {
    if (element.closest("footer") !== null) continue;
    const text = collapsed(element.textContent ?? "");
    if (isPlausibleName(text)) return text;
  }
  for (const root of doc.querySelectorAll("header, aside")) {
    if (root.closest("nav") !== null || root.closest("footer") !== null) continue;
    const links = [...root.querySelectorAll("a")].filter((anchor) => anchor.closest("nav") === null);
    const names = links.map((anchor) => collapsed(anchor.textContent ?? "")).filter(isPlausibleName);
    if (names.length === 1) return names[0] ?? "";
  }
  return "";
}

function pageAuthor(doc: Document, ldAuthor: string): string {
  return firstPlausible([
    namedMeta(doc, ["author", "byl", "citation_author", "dc.creator", "parsely-author", "sailthru.author"]),
    namedMeta(doc, ["article:author", "og:article:author"]),
    ldAuthor,
    namedMeta(doc, ["twitter:creator"]),
    visibleByline(doc),
  ]);
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
  const ld = jsonLdIdentity(doc);
  const author = pageAuthor(doc, ld.author);
  const publishedAt = metaContent(doc, ["article:published_time", "date", "pubdate", "dc.date"]);
  const siteName = firstPlausible([metaContent(doc, ["og:site_name", "application-name"]), ld.publisher]);
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
