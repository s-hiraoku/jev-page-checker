#!/usr/bin/env node
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { chromium } from "playwright-core";

const APP_NAME = "Jev 信憑性チェッカー";
const stateDir = process.env.JEV_VERIFY_STATE_DIR;
const origin = process.env.JEV_VERIFY_ORIGIN;
const sockPath = `${stateDir}/browser.sock`;

if (!stateDir || !origin) {
  process.stderr.write("JEV_VERIFY_STATE_DIR and JEV_VERIFY_ORIGIN are required\n");
  process.exit(1);
}

if (existsSync(sockPath)) unlinkSync(sockPath);

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ locale: "ja-JP", viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

async function waitReady() {
  await page.waitForFunction(
    (name) =>
      Boolean(document.body?.innerText.includes(name)) && !document.body.innerText.includes("プレビューを組み立てています"),
    APP_NAME,
    { timeout: 15000 },
  );
}

async function handle(req) {
  const { action } = req;
  if (action === "ping" || action === "quit") return { ok: true, out: action };
  if (action === "goto") {
    const path = req.path || "/";
    const url = path.startsWith("http") ? path : `${origin}${path}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitReady();
    return { ok: true, out: page.url() };
  }
  if (action === "click") {
    if (!req.name) return { ok: false, error: "browser click --name <accessible name>" };
    await page.getByRole("button", { name: req.name, exact: true }).click();
    await waitReady();
    return { ok: true, out: `clicked button ${req.name}` };
  }
  if (action === "fill") {
    if (!req.label || req.value === undefined) return { ok: false, error: "browser fill --label <label> --value <text>" };
    await page.getByLabel(req.label, { exact: true }).fill(String(req.value));
    return { ok: true, out: `filled ${req.label}` };
  }
  if (action === "check" || action === "uncheck") {
    if (!req.label) return { ok: false, error: `browser ${action} --label <label>` };
    const box = page.getByLabel(req.label, { exact: false });
    if (action === "check") await box.check();
    else await box.uncheck();
    return { ok: true, out: `${action} ${req.label}` };
  }
  if (action === "text") {
    if (!req.contains) return { ok: false, error: "browser text --contains <text>" };
    const body = await page.innerText("body");
    if (!body.includes(req.contains)) return { ok: false, error: `page text does not contain: ${req.contains}` };
    return { ok: true, out: `contains ${req.contains}` };
  }
  if (action === "wait") {
    if (!req.contains) return { ok: false, error: "browser wait --contains <text>" };
    await page.getByText(req.contains).first().waitFor({ timeout: 10000 });
    return { ok: true, out: `waited for ${req.contains}` };
  }
  if (action === "url") return { ok: true, out: page.url() };
  if (action === "screenshot") {
    if (!req.dest) return { ok: false, error: "browser screenshot --path <file>" };
    mkdirSync(dirname(req.dest), { recursive: true });
    await page.screenshot({ path: req.dest, fullPage: true });
    return { ok: true, out: req.dest };
  }
  if (action === "snapshot") {
    if (!req.dest) return { ok: false, error: "browser snapshot --path <file>" };
    mkdirSync(dirname(req.dest), { recursive: true });
    const snapshot = await page.locator("body").ariaSnapshot();
    writeFileSync(req.dest, `${snapshot}\n`);
    return { ok: true, out: req.dest };
  }
  return { ok: false, error: `unknown browser action: ${action}` };
}

const server = createServer((socket) => {
  let buf = "";
  socket.setEncoding("utf8");
  socket.on("error", () => {
    /* client went away */
  });
  socket.on("data", (chunk) => {
    buf += chunk;
    if (!buf.includes("\n")) return;
    const raw = buf.slice(0, buf.indexOf("\n"));
    buf = "";
    void (async () => {
      let req;
      try {
        req = JSON.parse(raw || "{}");
      } catch (error) {
        if (!socket.destroyed) socket.write(`${JSON.stringify({ ok: false, error: String(error) })}\n`);
        return;
      }
      try {
        const reply = await handle(req);
        if (!socket.destroyed) socket.write(`${JSON.stringify(reply)}\n`);
        if (req.action === "quit") {
          await browser.close();
          server.close();
          process.exit(0);
        }
      } catch (error) {
        if (!socket.destroyed) {
          socket.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);
        }
      }
    })();
  });
});

server.listen(sockPath);
process.stdout.write(`listening ${sockPath}\n`);
