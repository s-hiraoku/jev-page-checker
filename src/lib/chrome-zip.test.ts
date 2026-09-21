import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packer = path.join(repo, "scripts/pack-chrome-zip.py");

function writeZip(script: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "chrome-zip-"));
  const zipPath = path.join(dir, "item.zip");
  const result = spawnSync("python3", ["-c", script, zipPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return zipPath;
}

function check(zipPath: string) {
  return spawnSync("python3", [packer, "--check", zipPath], { encoding: "utf8" });
}

test("store zip is valid when manifest.json is at the archive root", () => {
  const zipPath = writeZip(
    "import json,sys,zipfile\n"
    + "z=zipfile.ZipFile(sys.argv[1],'w')\n"
    + "z.writestr('manifest.json', json.dumps({'manifest_version':3}))\n"
    + "z.writestr('background.js','')\n",
  );
  const result = check(zipPath);
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test("store zip is rejected when manifest.json is inside a folder", () => {
  const zipPath = writeZip(
    "import json,sys,zipfile\n"
    + "z=zipfile.ZipFile(sys.argv[1],'w')\n"
    + "z.writestr('jev-page-checker-1.0.0-chrome/manifest.json', json.dumps({'manifest_version':3}))\n",
  );
  const result = check(zipPath);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /nested at jev-page-checker-1.0.0-chrome\/manifest.json/);
});

test("store zip is rejected when History is registered as chrome://history", () => {
  const zipPath = writeZip(
    "import json,sys,zipfile\n"
    + "z=zipfile.ZipFile(sys.argv[1],'w')\n"
    + "z.writestr('manifest.json', json.dumps({'manifest_version':3,'chrome_url_overrides':{'history':'history.html'}}))\n",
  );
  const result = check(zipPath);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /chrome_url_overrides/);
});
