#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 4174;
const APP_TITLE = "Jev Audit preview";
const APP_NAME = "Audit";
const HERE = dirname(fileURLToPath(import.meta.url));

function die(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i += 1;
      }
    } else out._.push(token);
  }
  return out;
}

function runId() {
  return process.env.JEV_VERIFY_RUN_ID || "agent";
}

function stateDir() {
  return process.env.JEV_VERIFY_STATE_DIR || `/tmp/jev-verify-${runId()}`;
}

function statePath() {
  return resolve(stateDir(), "state.json");
}

function sockPath() {
  return resolve(stateDir(), "browser.sock");
}

function repoRoot() {
  return process.env.JEV_VERIFY_REPO || process.cwd();
}

function readState() {
  if (!existsSync(statePath())) {
    die(`No verification instance for run ${runId()}. Expected ${statePath()}. Run control-jev launch first.`);
  }
  return JSON.parse(readFileSync(statePath(), "utf8"));
}

function writeState(state) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(), `${JSON.stringify(state, null, 2)}\n`);
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function cmdlineOf(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
  } catch {
    return "";
  }
}

function portOwnerPids(port) {
  const result = spawnSync("bash", ["-lc", `lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`], {
    encoding: "utf8",
  });
  return (result.stdout ?? "")
    .split("\n")
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function ourVite(state) {
  if (!pidAlive(state.pid)) return false;
  const cmd = cmdlineOf(state.pid);
  if (cmd.includes("vite.preview.config.ts")) return true;
  if (cmd.includes("npm run preview") && cmd.includes(String(state.port))) return true;
  return portOwnerPids(state.port).some((pid) => cmdlineOf(pid).includes("vite.preview.config.ts"));
}

async function waitForHttp(origin, timeoutMs = 20000) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(origin, { redirect: "manual" });
      const body = await res.text();
      last = `${res.status}`;
      if (res.ok && body.includes(APP_TITLE)) return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  die(`Preview at ${origin} did not become ready (${last}).`);
}

function askDaemon(payload, timeoutMs = 30000) {
  return new Promise((resolveAsk, reject) => {
    const socket = createConnection(sockPath());
    let buf = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("browser daemon timed out"));
    }, timeoutMs);
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(payload)}\n`);
    });
    socket.on("data", (chunk) => {
      buf += chunk;
      if (buf.includes("\n")) {
        clearTimeout(timer);
        socket.destroy();
        try {
          resolveAsk(JSON.parse(buf.trim()));
        } catch (error) {
          reject(error);
        }
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      if (buf.includes("\n")) return;
      reject(error);
    });
  });
}

async function waitForSock(timeoutMs = 15000) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    if (existsSync(sockPath())) {
      try {
        const reply = await askDaemon({ action: "ping" });
        if (reply.ok) return;
        last = JSON.stringify(reply);
      } catch (error) {
        last = error instanceof Error ? error.message : String(error);
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  die(`Browser daemon did not become ready (${last}).`);
}

async function cmdLaunch(args) {
  const port = Number(args.port || process.env.JEV_VERIFY_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1) die("--port must be an integer");
  const origin = `http://127.0.0.1:${port}`;
  const repo = repoRoot();
  if (existsSync(statePath())) {
    const existing = JSON.parse(readFileSync(statePath(), "utf8"));
    if (ourVite(existing) && existing.port === port) {
      process.stdout.write(`already running pid=${existing.pid} origin=${existing.origin}\n`);
      return;
    }
    if (ourVite(existing)) die(`Run ${runId()} already has a preview on ${existing.origin}. Cleanup first.`);
  }
  const owners = portOwnerPids(port);
  if (owners.length > 0) {
    die(`Port ${port} is already in use by pid ${owners.join(",")}. Pick another --port. Do not drive a shared instance.`);
  }

  mkdirSync(stateDir(), { recursive: true });
  if (!existsSync(resolve(repo, ".wxt/tsconfig.json"))) {
    const prepared = spawnSync("npx", ["wxt", "prepare"], { cwd: repo, encoding: "utf8" });
    if (prepared.status !== 0) {
      die(`wxt prepare failed:\n${prepared.stdout}\n${prepared.stderr}`);
    }
  }
  const logPath = resolve(stateDir(), "preview.log");
  const logFd = openSync(logPath, "w");
  const child = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repo,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();

  const state = {
    runId: runId(),
    pid: child.pid,
    port,
    origin,
    repo,
    logPath,
    sockPath: sockPath(),
    startedAt: new Date().toISOString(),
  };
  writeState(state);

  try {
    await waitForHttp(origin);
  } catch (error) {
    killPid(child.pid);
    throw error;
  }

  const daemonLog = resolve(stateDir(), "daemon.log");
  const daemonFd = openSync(daemonLog, "w");
  const daemon = spawn(process.execPath, [resolve(HERE, "daemon.mjs")], {
    cwd: repo,
    detached: true,
    env: { ...process.env, JEV_VERIFY_STATE_DIR: stateDir(), JEV_VERIFY_ORIGIN: origin },
    stdio: ["ignore", daemonFd, daemonFd],
  });
  daemon.unref();
  state.daemonPid = daemon.pid;
  state.daemonLog = daemonLog;
  writeState(state);
  await waitForSock();
  process.stdout.write(`ready pid=${child.pid} daemon=${daemon.pid} origin=${origin}\n`);
}

async function cmdDoctor() {
  const state = readState();
  const problems = [];
  if (!pidAlive(state.pid)) problems.push(`preview pid ${state.pid} is not running`);
  else if (!ourVite(state)) problems.push(`pid ${state.pid} is not the vite preview we started (cmd=${cmdlineOf(state.pid)})`);
  const owners = portOwnerPids(state.port);
  if (owners.length === 0) problems.push(`nothing is listening on ${state.port}`);
  else if (!owners.includes(state.pid) && !owners.some((pid) => cmdlineOf(pid).includes("vite"))) {
    problems.push(`port ${state.port} is owned by ${owners.join(",")}, not this run`);
  }
  try {
    const res = await fetch(state.origin);
    const body = await res.text();
    if (!res.ok) problems.push(`GET ${state.origin} -> ${res.status}`);
    if (!body.includes(APP_TITLE)) problems.push(`response title is not ${APP_TITLE}`);
  } catch (error) {
    problems.push(`GET ${state.origin} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!pidAlive(state.daemonPid)) problems.push(`browser daemon pid ${state.daemonPid} is not running`);
  else {
    try {
      const pong = await askDaemon({ action: "ping" });
      if (!pong.ok) problems.push("browser daemon ping failed");
    } catch (error) {
      problems.push(`browser daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const report = {
    ok: problems.length === 0,
    runId: state.runId,
    origin: state.origin,
    pid: state.pid,
    daemonPid: state.daemonPid,
    title: APP_TITLE,
    app: APP_NAME,
    build: "preview via vite.preview.config.ts",
    problems,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (problems.length > 0) process.exit(1);
}

async function cmdBrowser(args) {
  const action = args._[1];
  if (!action) die("control-jev browser <goto|click|fill|select|check|uncheck|text|wait|url|screenshot|snapshot|attr>");
  const state = readState();
  if (!ourVite(state)) die("Doctor failed: preview process is not ours. Run control-jev doctor.");
  const payload = {
    action,
    path: args.path === true ? undefined : args.path,
    name: args.name === true ? undefined : args.name,
    selector: args.selector === true ? undefined : args.selector,
    label: args.label === true ? undefined : args.label,
    value: args.value === true ? undefined : args.value,
    contains: args.contains === true ? undefined : args.contains,
    dest: args.path && action !== "goto" ? resolveOut(args.path) : undefined,
  };
  if (action === "goto" && payload.path === undefined) payload.path = "/";
  if ((action === "screenshot" || action === "snapshot") && args.path) {
    payload.dest = resolveOut(args.path);
  }
  const reply = await askDaemon(payload);
  if (!reply.ok) die(reply.error || "browser command failed");
  process.stdout.write(`${reply.out || "ok"}\n`);
}

function resolveOut(p) {
  if (!p || p === true) die("--path is required");
  const dest = isAbsolute(p) ? p : resolve(process.cwd(), p);
  mkdirSync(dirname(dest), { recursive: true });
  return dest;
}

function killPid(pid) {
  if (!pid || !pidAlive(pid)) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

async function cmdCleanup() {
  if (!existsSync(statePath())) {
    process.stdout.write("nothing to clean\n");
    return;
  }
  const state = JSON.parse(readFileSync(statePath(), "utf8"));
  try {
    await askDaemon({ action: "quit" }, 3000);
  } catch {
    /* daemon already gone */
  }
  killPid(state.daemonPid);
  killPid(state.pid);
  const started = Date.now();
  while ((pidAlive(state.pid) || pidAlive(state.daemonPid)) && Date.now() - started < 3000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (pidAlive(state.pid)) {
    try {
      process.kill(state.pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
  if (pidAlive(state.daemonPid)) {
    try {
      process.kill(state.daemonPid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
  rmSync(stateDir(), { recursive: true, force: true });
  process.stdout.write(`cleaned pid=${state.pid} origin=${state.origin}\n`);
}

function usage() {
  process.stdout.write(`control-jev launch [--port ${DEFAULT_PORT}]
control-jev doctor
control-jev browser goto --path "/?scene=pass#side"
control-jev browser click --name "Settings"
control-jev browser select --label "テーマ" --value "light"
control-jev browser attr --selector "html" --name "data-theme"
control-jev browser check --label "このチェックリスト全体を承認する"
control-jev browser uncheck --label "タブに追従する"
control-jev browser text --contains "Pass"
control-jev browser wait --contains "保存しました。"
control-jev browser url
control-jev browser screenshot --path artifacts/side.png
control-jev browser snapshot --path artifacts/side.aria.txt
control-jev cleanup
`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (cmd === "launch") await cmdLaunch(args);
else if (cmd === "doctor") await cmdDoctor();
else if (cmd === "browser") await cmdBrowser(args);
else if (cmd === "cleanup") await cmdCleanup();
else {
  usage();
  if (cmd) die(`unknown command: ${cmd}`);
}
