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
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "Mina Ito");
  assert.equal(snapshot.siteName, "Example News");
  assert.equal(snapshot.hasAuthor, true);
  assert.equal(snapshot.hasBody, false);
  assert.equal(snapshot.isHttps, true);
  assert.match(snapshot.text, /bureau delayed/);
  assert.equal(snapshot.text.includes("Home Sports"), false);
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
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.pageKind, "portal");
  assert.equal(snapshot.hasArticle, false);
  assert.equal(snapshot.textTruncated, false);
});

test("extractSnapshot treats a long single text at the site root as an article", () => {
  const prose = Array.from({ length: 50 }, () => "The inspection memo is posted beside the pier photograph.").join(" ");
  const dom = new JSDOM(`<!doctype html><html><head><title>Memo</title></head><body><article>${prose}</article></body></html>`, {
    url: "https://writer.example.org/",
  });
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
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

test("extractSnapshot collects beyond one window and flags leftover after the coverable cap", () => {
  const prose = `abcdefghij leftover ${"x".repeat(20)}`;
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Memo</title></head><body>
      <nav>${"nav ".repeat(80)}</nav>
      <article>${prose}</article>
    </body></html>`,
    { url: "https://writer.example.org/memo" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 1, () => "2026-09-20T00:00:00.000Z", 10);
  assert.equal(snapshot.text.startsWith("abcdefghij"), true);
  assert.equal(snapshot.text.includes("nav"), false);
  assert.equal(snapshot.textTruncated, true);
  assert.equal(snapshot.text.length, 10);
});

test("extractSnapshot keeps a visible byline outside the main text", () => {
  const prose = Array.from({ length: 20 }, () => "The typed check is a hypothesis and still needs an experiment.").join(" ");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Types vs guesswork</title></head><body>
      <header><a href="/users/ada">Ada Example</a></header>
      <article>${prose}</article>
    </body></html>`,
    { url: "https://notes.example.org/users/ada/posts/types" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "Ada Example");
  assert.equal(snapshot.hasAuthor, true);
  assert.equal(snapshot.text.includes("Ada Example"), false);
});

test("extractSnapshot reads JSON-LD author when meta is a profile URL", () => {
  const prose = Array.from({ length: 20 }, () => "Inspect the posted memo before you publish the claim.").join(" ");
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    author: { "@type": "Person", name: "Ken Sato" },
    publisher: { "@type": "Organization", name: "Example Notes" },
  });
  const dom = new JSDOM(
    `<!doctype html><html><head>
      <title>Memo</title>
      <meta property="article:author" content="https://notes.example.org/users/ken" />
      <script type="application/ld+json">${ld}</script>
    </head><body><article>${prose}</article></body></html>`,
    { url: "https://notes.example.org/users/ken/memo" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "Ken Sato");
  assert.equal(snapshot.siteName, "Example Notes");
});

test("extractSnapshot reads rel=author in aside and still skips that chrome from the body text", () => {
  const prose = Array.from({ length: 20 }, () => "Mark unverified design claims as a hypothesis.").join(" ");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Hypothesis</title><meta property="og:site_name" content="Example Notes" /></head>
    <body>
      <aside><a rel="author" href="/u/ada">Ada Example</a></aside>
      <nav>Home Login</nav>
      <article>${prose}</article>
    </body></html>`,
    { url: "https://notes.example.org/u/ada/hypothesis" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "Ada Example");
  assert.equal(snapshot.siteName, "Example Notes");
  assert.equal(snapshot.text.includes("Ada Example"), false);
  assert.equal(snapshot.text.includes("Home Login"), false);
});

test("extractSnapshot does not treat nav labels as the author", () => {
  const prose = Array.from({ length: 20 }, () => "The bureau delayed the opening after the inspection memo.").join(" ");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Memo</title></head><body>
      <nav><a href="/">Home</a><a href="/login">Login</a></nav>
      <article>${prose}</article>
    </body></html>`,
    { url: "https://writer.example.org/memo" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "");
  assert.equal(snapshot.hasAuthor, false);
});

