import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { classifyPageKind, collectOutbound, collectText, extractSnapshot, wordCount } from "./extract.js";

test("wordCount ignores surrounding space", () => {
  assert.equal(wordCount("  one two  three "), 3);
  assert.equal(wordCount("   "), 0);
});

test("wordCount counts unspaced CJK so Japanese prose is not one token", () => {
  assert.ok(wordCount("発行元の特定と本文の精査は別の問題である") > 8);
});

test("collectOutbound keeps foreign http hosts and drops the page host", () => {
  const { hosts, citationCount } = collectOutbound(
    ["https://doi.example.org/10.1", "/local", "https://news.example.org/same", "mailto:x@y"],
    "news.example.org",
  );
  assert.deepEqual(hosts, ["doi.example.org"]);
  assert.equal(citationCount, 1);
});

test("extractSnapshot prefers article text, records author, and flags a short body", () => {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><head>
      <title>Bridge delay</title>
      <meta name="author" content="Mina Ito" />
      <meta property="og:site_name" content="Example News" />
    </head><body>
      <nav>Home Sports</nav>
      <article>The bureau delayed the opening. <a href="https://transport.example.gov/memo">memo</a></article>
    </body></html>`,
    { url: "https://news.example.org/reports/bridge-delay" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 1000, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "Mina Ito");
  assert.equal(snapshot.siteName, "Example News");
  assert.equal(snapshot.hasAuthor, true);
  assert.equal(snapshot.hasBody, false);
  assert.equal(snapshot.isHttps, true);
  assert.match(snapshot.text, /bureau delayed/);
  assert.equal(snapshot.text.includes("Home Sports"), false);
  assert.deepEqual(snapshot.outboundHosts, ["transport.example.gov"]);
  assert.equal(snapshot.pageKind, "article");
  assert.equal(snapshot.hasArticle, false);
  assert.equal(snapshot.textTruncated, false);
});

test("classifyPageKind uses structure, not the URL path", () => {
  assert.equal(classifyPageKind(1, 3, 80), "article");
  assert.equal(classifyPageKind(0, 40, 80), "portal");
  assert.equal(classifyPageKind(0, 4, 200), "article");
  assert.equal(classifyPageKind(1, 80, 90), "article");
});

test("extractSnapshot treats a link listing as a portal on any host", () => {
  const links = Array.from({ length: 50 }, (_, index) => `<a href="/n/${index}">headline ${index}</a>`).join("");
  const dom = new JSDOM(`<!doctype html><html><head><title>Headlines</title></head><body>${links}</body></html>`, {
    url: "https://news.example.org/",
  });
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 1000, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.pageKind, "portal");
  assert.equal(snapshot.hasArticle, false);
  assert.equal(snapshot.textTruncated, false);
});

test("extractSnapshot treats a long single text at the site root as an article", () => {
  const prose = Array.from({ length: 50 }, () => "The inspection memo is posted beside the pier photograph.").join(" ");
  const dom = new JSDOM(`<!doctype html><html><head><title>Memo</title></head><body><article>${prose}</article></body></html>`, {
    url: "https://writer.example.org/",
  });
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 4000, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.pageKind, "article");
  assert.equal(snapshot.hasArticle, true);
  assert.equal(snapshot.textTruncated, false);
});

test("collectText records leftover prose after the character limit", () => {
  const dom = new JSDOM(`<!doctype html><p>abcdefghij leftover claim</p>`);
  const collected = collectText(dom.window.document.body, 10);
  assert.equal(collected.text, "abcdefghij");
  assert.equal(collected.truncated, true);
});

test("collectText is not truncated when the main text fits", () => {
  const dom = new JSDOM(`<!doctype html><p>abcdefghij</p>`);
  const collected = collectText(dom.window.document.body, 10);
  assert.equal(collected.text, "abcdefghij");
  assert.equal(collected.truncated, false);
});

test("collectText flags leftover text in a later node after an exact fit", () => {
  const dom = new JSDOM(`<!doctype html><p>abcdefghij</p><p>more</p>`);
  const collected = collectText(dom.window.document.body, 10);
  assert.equal(collected.text, "abcdefghij");
  assert.equal(collected.truncated, true);
});

test("extractSnapshot flags truncation from leftover main text, not from skipped chrome", () => {
  const prose = "abcdefghij leftover";
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Memo</title></head><body>
      <nav>${"nav ".repeat(80)}</nav>
      <article>${prose}</article>
    </body></html>`,
    { url: "https://writer.example.org/memo" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 10, 1, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.text, "abcdefghij");
  assert.equal(snapshot.textTruncated, true);
});
