import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const playwrightEntry = join(root, ".cursor/skills/verify-jev-page-checker/node_modules/playwright-core/index.mjs");
if (!existsSync(playwrightEntry)) {
  throw new Error("playwright-core is missing. Run control-jev launch first so the verify skill can install it.");
}
const { chromium } = await import(playwrightEntry);
const out = join(root, "store/images");
const origin = process.env.JEV_VERIFY_ORIGIN ?? "http://127.0.0.1:4174";
mkdirSync(out, { recursive: true });

const shots = [
  { name: "screenshot-side-pass.png", path: "/?scene=pass&store=1#side", wait: "報道ページの例" },
  { name: "screenshot-side-fail.png", path: "/?scene=fail&store=1#side", wait: "販売ページの例" },
  { name: "screenshot-options.png", path: "/?scene=setup&store=1#options", wait: "質問 9" },
  { name: "screenshot-details.png", path: "/?scene=pass&store=1#details", wait: "送った文" },
  { name: "screenshot-history.png", path: "/?scene=pass&store=1#history", wait: "過去の Audit" },
];

function pngIhdr(file) {
  const data = readFileSync(file);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const bitDepth = data[24];
  const colorType = data[25];
  return { width, height, bitDepth, colorType };
}

function toRgbPng(file) {
  const tmp = `${file}.rgb.png`;
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", file, "-pix_fmt", "rgb24", tmp],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "ffmpeg failed");
  }
  renameSync(tmp, file);
}

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  locale: "ja-JP",
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

try {
  for (const shot of shots) {
    const dest = join(out, shot.name);
    await page.goto(`${origin}${shot.path}`, { waitUntil: "networkidle" });
    await page.getByText(shot.wait).first().waitFor({ timeout: 10_000 });
    await page.locator(".app-name").first().waitFor({ timeout: 10_000 });
    await page.screenshot({ path: dest, fullPage: false, animations: "disabled" });
    toRgbPng(dest);
    const info = pngIhdr(dest);
    if (info.width !== 1280 || info.height !== 800 || info.colorType !== 2) {
      throw new Error(`${shot.name} is ${JSON.stringify(info)}, expected 1280x800 RGB`);
    }
    writeFileSync(process.stdout.fd, `${shot.name} ${info.width}x${info.height} colorType=${info.colorType}\n`);
  }
} finally {
  await browser.close();
}
