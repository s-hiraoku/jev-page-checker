import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { classifyPageKind, collectOutbound, extractSnapshot, wordCount } from "./extract.js";

test("wordCount ignores surrounding space", () => {
  assert.equal(wordCount("  one two  three "), 3);
  assert.equal(wordCount("   "), 0);
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
});

test("classifyPageKind treats the site root and index as a portal", () => {
  assert.equal(classifyPageKind("/", 8, 200), "portal");
  assert.equal(classifyPageKind("/index.html", 0, 10), "portal");
  assert.equal(classifyPageKind("/mizchi/articles/jev", 1, 18), "article");
  assert.equal(classifyPageKind("/topics", 0, 80), "portal");
});

test("extractSnapshot marks a homepage listing as a portal without an article body", () => {
  const links = Array.from({ length: 50 }, (_, index) => `<a href="/n/${index}">headline ${index}</a>`).join("");
  const dom = new JSDOM(`<!doctype html><html><head><title>Yahoo! JAPAN</title></head><body>${links}</body></html>`, {
    url: "https://www.yahoo.co.jp/",
  });
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 1000, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.pageKind, "portal");
  assert.equal(snapshot.hasArticle, false);
});
