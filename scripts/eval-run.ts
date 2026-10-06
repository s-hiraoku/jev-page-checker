// Audit eval runner. Runs the real checkSnapshot over labeled pages in eval/cases/ and grades the verdicts.
// Output follows the hillclimb layout: .claude/hillclimb/page-audit/<variant>/{results.jsonl,errors.jsonl,traces/,summary.json}.
// Keys come from the environment: ANTHROPIC_API_KEY for Claude, TYPESAFE_API_KEY for Jev.
//
//   npm run eval -- --variant baseline --engine claude --model claude-opus-5-5 --reps 1
//   npm run eval -- --variant baseline --engine jev
//   npm run eval -- --summary baseline          (re-print a finished run)
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { TypeSafeError } from "@typesafe-ai/sdk";
import definitionRaw from "../fixtures/page-credibility.checker.json" with { type: "json" };
import { buildCategoryDefinition } from "../src/lib/category-definition.js";
import { parseDefinition, type CheckReport, type JevGateway, type JevReply } from "../src/lib/checkkit.js";
import { ClaudeAnswerError, claudeGateway } from "../src/lib/claude-gateway.js";
import { DEFAULT_CLAUDE_MODEL } from "../src/lib/claude-models.js";
import { gradeCase, meanInterval, parseEvalCase, snapshotForCase, splitFor, type EvalCase, type Split } from "../src/lib/eval-case.js";
import { checkSnapshot, createLiveJev } from "../src/lib/run-check.js";

const ROOT = resolve(import.meta.dirname, "..");
const CASES_DIR = join(ROOT, "eval/cases");
const FLOW_DIR = join(ROOT, ".claude/hillclimb/page-audit");
const STATE_PATH = join(FLOW_DIR, "_state.json");
/** The grader, the runner, and the labels. A hill-climb may change prompts and questions, never these. */
const HARNESS_FILES = ["scripts/eval-run.ts", "src/lib/eval-case.ts"];

const { values: options } = parseArgs({
  options: {
    variant: { type: "string", default: "baseline" },
    engine: { type: "string", default: "claude" },
    model: { type: "string", default: DEFAULT_CLAUDE_MODEL },
    reps: { type: "string", default: "1" },
    split: { type: "string", default: "all" },
    concurrency: { type: "string", default: "4" },
    "timeout-s": { type: "string", default: "300" },
    "include-drafts": { type: "boolean", default: false },
    "approve-harness": { type: "boolean", default: false },
    summary: { type: "string" },
  },
});

function fail(message: string, code = 2): never {
  console.error(message);
  process.exit(code);
}

function loadCases(): EvalCase[] {
  if (!existsSync(CASES_DIR)) return [];
  return readdirSync(CASES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => parseEvalCase(JSON.parse(readFileSync(join(CASES_DIR, name), "utf8")), name));
}

function harnessSha(): string {
  const hash = createHash("sha256");
  const files = [...HARNESS_FILES, ...readdirSync(CASES_DIR).filter((name) => name.endsWith(".json")).sort().map((name) => `eval/cases/${name}`)];
  for (const file of files) hash.update(`${file}\0`).update(readFileSync(join(ROOT, file))).update("\0");
  return hash.digest("hex");
}

/** Refuses to run when the grader, runner, or labels changed since a person last approved them. */
function checkHarness(): void {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Record<string, unknown>;
  const sha = harnessSha();
  if (options["approve-harness"]) {
    writeFileSync(STATE_PATH, `${JSON.stringify({ ...state, harness_sha: sha }, null, 2)}\n`);
    console.error(`Harness approved: ${sha.slice(0, 12)}`);
    return;
  }
  if (state.harness_sha !== sha) {
    fail("The runner, grader, or labeled cases changed since they were approved. Review the change, then run once with --approve-harness.");
  }
}

interface Call {
  request: unknown;
  reply?: JevReply;
  error?: string;
}

/** Wraps the engine so each request and answer lands in the transcript, and a failed request is never scored. */
function recording(gateway: JevGateway, calls: Call[]): JevGateway {
  return {
    async ask(request) {
      const call: Call = { request };
      calls.push(call);
      try {
        call.reply = await gateway.ask(request);
        return call.reply;
      } catch (error) {
        call.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        throw error;
      }
    },
  };
}

function errorClass(message: string): string {
  if (message.startsWith("Timeout")) return "timeout";
  if (message.includes("declined")) return "refusal";
  if (message.startsWith("ModelMismatch")) return "model_mismatch";
  if (message.startsWith("ClaudeAnswerError")) return "answer_error";
  return "api_error";
}

function gatewayFor(engine: string, model: string): JevGateway {
  if (engine === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) fail("Set ANTHROPIC_API_KEY.");
    const inner = claudeGateway(new Anthropic({ timeout: 180_000, maxRetries: 3 }), model);
    return {
      async ask(request) {
        const reply = await inner.ask(request);
        // A refusal fallback or reroute to another model would make the comparison meaningless.
        if (reply.model !== undefined && !reply.model.startsWith(model)) {
          const error = new Error(`served ${reply.model}, requested ${model}`);
          error.name = "ModelMismatch";
          throw error;
        }
        return reply;
      },
    };
  }
  if (engine === "jev") {
    if (!process.env.TYPESAFE_API_KEY) fail("Set TYPESAFE_API_KEY.");
    return createLiveJev(process.env.TYPESAFE_API_KEY);
  }
  return fail(`Unknown engine "${engine}". Use claude or jev.`);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`case exceeded ${ms / 1000} s`);
      error.name = "Timeout";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function transcript(evalCase: EvalCase, engine: string, calls: readonly Call[], report: CheckReport | undefined, mismatches: readonly string[]) {
  const turns: { role: string; content: string }[] = [
    { role: "system", content: `engine: ${engine}\ncase: ${evalCase.id}\nurl: ${evalCase.snapshot.url}` },
  ];
  for (const call of calls) {
    turns.push({ role: "user", content: JSON.stringify(call.request, null, 2) });
    turns.push({ role: "assistant", content: call.error ?? JSON.stringify({ model: call.reply?.model, answers: call.reply?.answers, usage: call.reply?.usage }, null, 2) });
  }
  if (report !== undefined) {
    const verdicts = report.items.map((item) => `${item.id}: ${item.verdict}`).join("\n");
    turns.push({
      role: "assistant",
      content: `Verdicts\n${verdicts}\n\nCategory: ${report.classification?.primary ?? report.classification?.status ?? "-"}\n\nMismatches\n${mismatches.join("\n") || "none"}`,
    });
  }
  return turns;
}

interface Row {
  prompt_id: string;
  rep: number;
  split: Split;
  grade: Record<string, number>;
  meta: { counts: { labeled: number; correct: number; riskyLabeled: number; safeLabeled: number }; labeledBy: string };
}

function readRows(variantDir: string): Row[] {
  const path = join(variantDir, "results.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Row);
}

function percent(value: number): string {
  return Number.isNaN(value) ? "-" : `${(value * 100).toFixed(1)}%`;
}

function summarize(variant: string): void {
  const variantDir = join(FLOW_DIR, variant);
  const rows = readRows(variantDir);
  const errorsPath = join(variantDir, "errors.jsonl");
  const errors = existsSync(errorsPath) ? readFileSync(errorsPath, "utf8").split("\n").filter(Boolean).length : 0;
  const summary: Record<string, unknown> = { variant, errors };
  const lines = [`${variant}: ${rows.length} graded rows, ${errors} failed attempts`];
  for (const split of ["train", "test", "all"] as const) {
    const scoped = rows.filter((row) => split === "all" || row.split === split);
    if (scoped.length === 0) continue;
    const acc = meanInterval(scoped.map((row) => row.grade.verdict_acc ?? 0));
    const exact = meanInterval(scoped.map((row) => row.grade.all_correct ?? 0));
    const risky = scoped.reduce((sum, row) => sum + row.meta.counts.riskyLabeled, 0);
    const safe = scoped.reduce((sum, row) => sum + row.meta.counts.safeLabeled, 0);
    const falsePass = scoped.reduce((sum, row) => sum + (row.grade.false_pass ?? 0), 0);
    const falseAlert = scoped.reduce((sum, row) => sum + (row.grade.false_alert ?? 0), 0);
    const categorized = scoped.filter((row) => row.grade.category_ok !== undefined);
    const category = meanInterval(categorized.map((row) => row.grade.category_ok ?? 0));
    summary[split] = { verdict_acc: acc, all_correct: exact, false_pass_rate: risky ? falsePass / risky : null, false_alert_rate: safe ? falseAlert / safe : null, category_ok: category };
    lines.push(
      `  ${split.padEnd(5)} n=${acc.n}  verdict_acc ${percent(acc.mean)} [${percent(acc.lo)}, ${percent(acc.hi)}]  all_correct ${percent(exact.mean)}` +
        `  false_pass ${falsePass}/${risky}  false_alert ${falseAlert}/${safe}  category ${percent(category.mean)} (n=${category.n})`,
    );
  }
  mkdirSync(variantDir, { recursive: true });
  writeFileSync(join(variantDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  if (options.summary !== undefined) {
    summarize(options.summary);
    return;
  }
  const variant = options.variant ?? "baseline";
  if (!/^(baseline|v\d+)$/.test(variant)) fail(`--variant must be "baseline" or v<N>, not "${variant}".`);
  checkHarness();
  if (options["approve-harness"]) return;

  const engine = options.engine ?? "claude";
  const model = engine === "claude" ? options.model ?? DEFAULT_CLAUDE_MODEL : "jev";
  const reps = Math.max(1, Number(options.reps));
  const concurrency = Math.max(1, Number(options.concurrency));
  const timeoutMs = Math.max(10, Number(options["timeout-s"])) * 1000;
  const definition = buildCategoryDefinition(parseDefinition(definitionRaw));
  const gateway = gatewayFor(engine, model);

  const cases = loadCases()
    .filter((evalCase) => options["include-drafts"] || evalCase.labeledBy === "human")
    .filter((evalCase) => Object.keys(evalCase.expected.items).length > 0 || evalCase.expected.category !== undefined)
    .filter((evalCase) => options.split === "all" || splitFor(evalCase.id) === options.split);
  if (cases.length === 0) fail("No labeled cases to run. Label cases in eval/cases/ (labeledBy: \"human\"), or pass --include-drafts.");

  const variantDir = join(FLOW_DIR, variant);
  mkdirSync(join(variantDir, "traces"), { recursive: true });
  const done = new Set(readRows(variantDir).map((row) => `${row.prompt_id}#${row.rep}`));
  const jobs = cases.flatMap((evalCase) => Array.from({ length: reps }, (_, rep) => ({ evalCase, rep }))).filter(({ evalCase, rep }) => !done.has(`${evalCase.id}#${rep}`));
  console.error(`${variant}: ${jobs.length} attempts (${cases.length} cases × ${reps} reps, ${done.size} already done) on ${engine}${engine === "claude" ? ` ${model}` : ""}`);

  let next = 0;
  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const { evalCase, rep } = jobs[next++]!;
      const calls: Call[] = [];
      const started = performance.now();
      const base = { prompt_id: evalCase.id, rep, split: splitFor(evalCase.id) };
      try {
        const report = await withTimeout(checkSnapshot(snapshotForCase(evalCase), definition, recording(gateway, calls)), timeoutMs);
        const failed = calls.find((call) => call.error !== undefined);
        // checkSnapshot softens some request failures into Review. In the eval that is plumbing, not a verdict.
        if (failed) throw Object.assign(new Error(failed.error), { name: failed.error!.split(":")[0]! });
        const { grade, counts, mismatches } = gradeCase(evalCase, report);
        const served = [...new Set(calls.map((call) => call.reply?.model).filter((value): value is string => value !== undefined))];
        const usage = report.usage;
        const traceName = `${evalCase.id}_rep${rep}.json`;
        writeFileSync(join(variantDir, "traces", traceName), JSON.stringify(transcript(evalCase, engine, calls, report, mismatches), null, 2));
        const row = {
          ...base,
          prompt: `${evalCase.snapshot.title || "(untitled)"}\n${evalCase.snapshot.url}`,
          tags: evalCase.tags,
          status: "ok",
          stop_reason: "end_turn",
          grade,
          explanation: { verdict_acc: mismatches.join("\n") || "all labeled items match" },
          model: served.join(",") || model,
          usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
          latency_s: Math.round(performance.now() - started) / 1000,
          in_tokens: usage.input_tokens,
          out_tokens: usage.output_tokens,
          requests: calls.length,
          meta: { counts, labeledBy: evalCase.labeledBy, engine },
        };
        appendFileSync(join(variantDir, "results.jsonl"), `${JSON.stringify(row)}\n`);
        console.error(`  ${evalCase.id}#${rep} ${percent(grade.verdict_acc)}${mismatches.length ? `  (${mismatches.length} off)` : ""}`);
      } catch (error) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        const usage = calls.reduce(
          (sum, call) => ({ input_tokens: sum.input_tokens + (call.reply?.usage.input_tokens ?? 0), output_tokens: sum.output_tokens + (call.reply?.usage.output_tokens ?? 0) }),
          { input_tokens: 0, output_tokens: 0 },
        );
        const cls = error instanceof TypeSafeError || error instanceof Anthropic.APIError ? "api_error" : error instanceof ClaudeAnswerError ? errorClass(`ClaudeAnswerError: ${error.message}`) : errorClass(message);
        appendFileSync(join(variantDir, "errors.jsonl"), `${JSON.stringify({ ...base, class: cls, message, requests: calls.length, usage, model })}\n`);
        console.error(`  ${evalCase.id}#${rep} ERROR ${cls}: ${message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  summarize(variant);
}

await main();
