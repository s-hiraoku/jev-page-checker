// Run the same checklist on one page state with Jev and with Claude, and print the verdicts side by side.
// Keys come from the environment: ANTHROPIC_API_KEY for Claude, TYPESAFE_API_KEY for Jev (optional).
// Usage: npm run compare -- fixtures/replay/page-credibility-essay.json [claude-opus-5-5|claude-sonnet-5-5]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import definitionRaw from "../fixtures/page-credibility.checker.json" with { type: "json" };
import { buildCategoryDefinition } from "../src/lib/category-definition.js";
import { parseDefinition, type CheckReport, type JevGateway } from "../src/lib/checkkit.js";
import { claudeGateway } from "../src/lib/claude-gateway.js";
import { DEFAULT_CLAUDE_MODEL, isClaudeModel } from "../src/lib/claude-models.js";
import { snapshotFromReplay, type ReplayFixture } from "../src/lib/replay.js";
import { checkSnapshot, createLiveJev } from "../src/lib/run-check.js";

const [path, modelArg] = process.argv.slice(2);
if (path === undefined) {
  console.error("Usage: npm run compare -- <page state JSON> [model]");
  process.exit(2);
}
const model = isClaudeModel(modelArg) ? modelArg : DEFAULT_CLAUDE_MODEL;
const file = JSON.parse(readFileSync(resolve(path), "utf8")) as Partial<ReplayFixture> & ReplayFixture["state"];
const snapshot = snapshotFromReplay(file.state ?? file);
const definition = buildCategoryDefinition(parseDefinition(definitionRaw));

async function run(name: string, gateway: JevGateway): Promise<[string, CheckReport]> {
  const started = performance.now();
  const report = await checkSnapshot(snapshot, definition, gateway);
  console.error(`${name}: ${Math.round(performance.now() - started)} ms, ${report.usage.input_tokens} in / ${report.usage.output_tokens} out`);
  return [name, report];
}

const runs: Promise<[string, CheckReport]>[] = [];
if (process.env.ANTHROPIC_API_KEY) runs.push(run(`claude:${model}`, claudeGateway(new Anthropic(), model)));
if (process.env.TYPESAFE_API_KEY) runs.push(run("jev", createLiveJev(process.env.TYPESAFE_API_KEY)));
if (runs.length === 0) {
  console.error("Set ANTHROPIC_API_KEY, TYPESAFE_API_KEY, or both.");
  process.exit(2);
}

const reports = await Promise.all(runs);
const ids = [...new Set(reports.flatMap(([, report]) => report.items.map((item) => item.id)))];
const rows = ids.map((id) => ({
  id,
  ...Object.fromEntries(reports.map(([name, report]) => [name, report.items.find((item) => item.id === id)?.verdict ?? "-"])),
}));
console.table(rows);
for (const [name, report] of reports) {
  console.log(`${name} classification: ${report.classification?.primary ?? report.classification?.status ?? "-"}, site type: ${report.siteType?.id ?? report.siteType?.status ?? "-"}`);
}
