// Fetch a page, extract it the way the content script does, and write an unlabeled eval case.
// Pages that build their text with JavaScript come out thinner than in the browser; for those,
// use "Save as eval case" on the extension's report page instead.
//
//   npm run eval:capture -- https://example.org/some/article [case-id]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { DEFAULT_SETTINGS } from "../src/lib/settings.js";
import { extractSnapshot } from "../src/lib/extract.js";
import type { EvalCase } from "../src/lib/eval-case.js";

const [url, idArg] = process.argv.slice(2);
if (url === undefined) {
  console.error("Usage: npm run eval:capture -- <url> [case-id]");
  process.exit(2);
}
const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (jev-page-checker eval capture)" } });
if (!response.ok) {
  console.error(`${url}: HTTP ${response.status}`);
  process.exit(1);
}
const dom = new JSDOM(await response.text(), { url: response.url });
const { extractedAt: _extractedAt, ...snapshot } = extractSnapshot(dom.window.document, dom.window.location, DEFAULT_SETTINGS.minWords);
const id = idArg ?? `${snapshot.hostname}-${new URL(snapshot.url).pathname}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const evalCase: EvalCase = {
  id,
  tags: ["unlabeled", "source:capture", ...(snapshot.language ? [`lang:${snapshot.language}`] : [])],
  source: "capture",
  labeledBy: "draft",
  notes: "",
  snapshot,
  expected: { items: {} },
};
const dir = resolve(import.meta.dirname, "../eval/cases");
mkdirSync(dir, { recursive: true });
const path = join(dir, `${id}.json`);
if (existsSync(path)) {
  console.error(`${path} already exists.`);
  process.exit(1);
}
writeFileSync(path, `${JSON.stringify(evalCase, null, 2)}\n`);
console.log(`${path}: ${snapshot.pageKind}, ${snapshot.wordCount} words, author "${snapshot.author}". Fill in expected and set labeledBy to "human".`);
