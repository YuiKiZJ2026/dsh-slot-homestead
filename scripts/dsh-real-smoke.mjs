#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "dsh-desktop-slot-widget";
const DSH_VERSION = "0.1.1-rc.2";
const PROFILE = "web";
const COMMAND_TIMEOUT_MS = 180_000;
const START_TIMEOUT_MS = 90_000;
const HTTP_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 2 * 1_024 * 1_024;

export function parseDshWebUrl(output) {
  const announced = [...String(output).matchAll(/(?:^|\r?\n)dsh web:\s*(https?:\/\/\S+)/g)];
  if (announced.length === 0) throw new Error("DSH web URL announcement was not found");
  const url = new URL(announced.at(-1)[1]);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error(`DSH web URL must use HTTP loopback, received ${url.href}`);
  }
  if (url.port === "" || Number(url.port) === 0) {
    throw new Error(`DSH web URL must contain a nonzero OS-assigned port, received ${url.href}`);
  }
  if (url.username !== "" || url.password !== "" || url.pathname !== "/" || url.search !== "") {
    throw new Error(`DSH web URL must be an origin root, received ${url.href}`);
  }
  return url.href;
}

export function configHasPluginRow(config, pluginId) {
  const lines = String(config).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const idMatch = /^(\s*)-\s+id:\s*(.*?)\s*$/.exec(lines[index]);
    if (idMatch === null || yamlScalar(idMatch[2]) !== pluginId) continue;
    const rowIndent = idMatch[1].length;
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next];
      const content = line.trim();
      if (content === "" || content.startsWith("#")) continue;
      const indent = line.length - line.trimStart().length;
      if (indent <= rowIndent && /^-\s+/.test(line.trimStart())) break;
      const nameMatch = /^\s*name:\s*(.*?)\s*$/.exec(line);
      if (nameMatch !== null && yamlScalar(nameMatch[1]) === pluginId) return true;
    }
  }
  return false;
}

export function pluginEntryFromBootManifest(html, pluginId) {
  const assignment = /(?:globalThis|window)(?:\.__DSH_BOOT__|\[["']__DSH_BOOT__["']\])\s*=\s*/g;
  const match = assignment.exec(String(html));
  if (match === null) throw new Error("Root document is missing the DSH boot manifest");
  const source = String(html);
  const start = source.indexOf("{", assignment.lastIndex);
  if (start < 0) throw new Error("Root DSH boot manifest has no JSON object");
  const manifest = JSON.parse(readBalancedObject(source, start));
  if (!isRecord(manifest) || typeof manifest.rev !== "string" || !Array.isArray(manifest.entries)) {
    throw new Error("Root DSH boot manifest has an invalid graph shape");
  }
  const entry = manifest.entries.find((candidate) =>
    isRecord(candidate) && candidate.id === pluginId);
  if (!isRecord(entry) || typeof entry.url !== "string" || typeof entry.rev !== "string") {
    throw new Error(`DSH boot manifest is missing plugin ${pluginId}`);
  }
  const clientUrl = new URL(entry.url, "http://127.0.0.1");
  if (clientUrl.pathname !== `/plugins/${pluginId}/client.js`) {
    throw new Error(`DSH boot manifest has the wrong client URL for ${pluginId}`);
  }
  return { id: pluginId, url: entry.url, rev: entry.rev };
}

export function assertClientBundle(source, pluginId) {
  const escaped = escapeRegExp(pluginId);
  const hasLoader = /(?:window\.)?__ModuleLoader__\.load\s*\(/.test(String(source));
  const hasId = new RegExp(`(?:["']?id["']?)\\s*:\\s*["']${escaped}["']`).test(String(source));
  if (!hasLoader || !hasId) {
    throw new Error(`DSH lazy client bundle identity is invalid for ${pluginId}`);
  }
}

export function assertClaimTransition(initial, claimed) {
  const before = snapshotNumbers(initial, "initial state");
  const after = snapshotNumbers(claimed, "claimDaily state");
  if (
    after.revision !== before.revision + 1 ||
    after.wallet !== before.wallet + 3 ||
    typeof claimed.lastGrantedLocalDate !== "string"
  ) {
    throw new Error("Real claimDaily route did not atomically grant three coins and one revision");
  }
}

export function assertPersistedSnapshot(expected, restarted) {
  const before = snapshotNumbers(expected, "pre-restart state");
  const after = snapshotNumbers(restarted, "post-restart state");
  if (
    after.revision !== before.revision ||
    after.wallet !== before.wallet ||
    restarted.lastGrantedLocalDate !== expected.lastGrantedLocalDate
  ) {
    throw new Error("DSH restart persistence check failed for wallet or revision");
  }
}

export function assertDifferentWebPort(firstUrl, restartedUrl) {
  const firstPort = new URL(firstUrl).port;
  const restartedPort = new URL(restartedUrl).port;
  if (firstPort === restartedPort) {
    throw new Error(`DSH restart port must differ from ${firstPort}`);
  }
}

export function assertGracefulSigintExit(outcome, platform = process.platform) {
  const expected = platform === "win32"
    ? isRecord(outcome) && outcome.code === null && outcome.signal === "SIGINT"
    : isRecord(outcome) && outcome.code === 130 && outcome.signal === null;
  if (!expected) {
    const code = isRecord(outcome) ? outcome.code : undefined;
    const signal = isRecord(outcome) ? outcome.signal : undefined;
    throw new Error(
      `dsh web SIGINT must exit with the graceful ${platform} outcome; ` +
      `received code=${code}, signal=${signal}`,
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const dsh = createDshInvocation(options.dsh, options.dshEntry);
  const tgz = resolve(options.tgz);
  const tgzStat = await stat(tgz).catch(() => null);
  if (tgzStat === null || !tgzStat.isFile()) throw new Error(`Plugin tgz does not exist: ${tgz}`);

  const home = await mkdtemp(join(tmpdir(), "dsh-slot-real-smoke-"));
  const environment = {
    ...process.env,
    CI: "1",
    DSH_HOME: home,
    NO_COLOR: "1",
  };
  let activeWeb = null;
  let heldRestartPort = null;

  try {
    const version = await runCommand(dsh, ["--version"], environment, 30_000);
    assertExactDshVersion(version.stdout + version.stderr);

    await runCommand(
      dsh,
      ["plugin", "--profile", PROFILE, "add", tgz],
      environment,
      COMMAND_TIMEOUT_MS,
    );
    const installedConfig = await dumpConfig(dsh, environment);
    if (!configHasPluginRow(installedConfig, PLUGIN_ID)) {
      throw new Error(`Composed ${PROFILE} config is missing the ${PLUGIN_ID} row`);
    }

    activeWeb = await startWeb(dsh, environment);
    const firstUrl = activeWeb.url;
    const firstState = await assertRunningComposition(firstUrl);
    const claimedState = await claimDaily(firstUrl, firstState);
    assertClaimTransition(firstState, claimedState);
    await stopWeb(activeWeb);
    activeWeb = null;

    // Hold the first OS-assigned port while restarting, making the new-port
    // assertion deterministic instead of relying on allocator luck.
    heldRestartPort = await holdLoopbackPort(firstUrl);
    activeWeb = await startWeb(dsh, environment);
    assertDifferentWebPort(firstUrl, activeWeb.url);
    await closeServer(heldRestartPort);
    heldRestartPort = null;

    const restartedState = await getState(activeWeb.url);
    assertPersistedSnapshot(claimedState, restartedState);
    await stopWeb(activeWeb);
    activeWeb = null;

    await runCommand(
      dsh,
      ["plugin", "--profile", PROFILE, "remove", PLUGIN_ID],
      environment,
      COMMAND_TIMEOUT_MS,
    );
    const removedConfig = await dumpConfig(dsh, environment);
    if (configHasPluginRow(removedConfig, PLUGIN_ID)) {
      throw new Error(`Composed ${PROFILE} config retained the ${PLUGIN_ID} row after remove`);
    }

    console.log(`real DSH smoke passed with ${basename(tgz)} in isolated profile ${PROFILE}`);
  } finally {
    if (activeWeb !== null) await forceStopWeb(activeWeb);
    if (heldRestartPort !== null) await closeServer(heldRestartPort);
    await rm(home, { recursive: true, force: true });
  }
}

async function assertRunningComposition(baseUrl) {
  const root = await requestText(new URL("/", baseUrl), {}, "DSH root");
  pluginEntryFromBootManifest(root, PLUGIN_ID);

  const client = await requestText(
    new URL(`/plugins/${PLUGIN_ID}/client.js`, baseUrl),
    {},
    "plugin client bundle",
  );
  assertClientBundle(client, PLUGIN_ID);
  return getState(baseUrl);
}

async function getState(baseUrl) {
  const url = new URL("/api/dsh-slot-widget/state", baseUrl);
  url.searchParams.set("sessionId", "real-dsh-smoke");
  const envelope = await requestJson(url, { method: "GET" }, "plugin state route");
  return snapshotFromEnvelope(envelope, "plugin state route");
}

async function claimDaily(baseUrl, initial) {
  const envelope = await requestJson(new URL("/api/dsh-slot-widget/command", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      commandId: randomUUID(),
      sessionId: "real-dsh-smoke",
      expectedRevision: initial.revision,
      issuedAt: new Date().toISOString(),
      type: "claimDaily",
    }),
  }, "claimDaily route");
  return snapshotFromEnvelope(envelope, "claimDaily route");
}

async function dumpConfig(dsh, environment) {
  const result = await runCommand(
    dsh,
    ["--profile", PROFILE, "--dump-config"],
    environment,
    COMMAND_TIMEOUT_MS,
  );
  return result.stdout;
}

async function startWeb(dsh, environment) {
  const child = spawn(dsh.command, [
    ...dsh.prefixArgs,
    "web",
    "--host", "127.0.0.1",
    "--port", "0",
    "--no-open",
  ], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = createBoundedOutput();

  try {
    const url = await new Promise((resolveStart, rejectStart) => {
      let settled = false;
      const timeout = setTimeout(() => finish(
        new Error(`Timed out waiting for dsh web URL\n${output.value()}`),
      ), START_TIMEOUT_MS);

      const finish = (error, url) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.off("error", onError);
        child.off("exit", onExit);
        if (error === null) resolveStart(url);
        else rejectStart(error);
      };
      const inspectLine = (line) => {
        output.append(`${line}\n`);
        if (!line.startsWith("dsh web:")) return;
        try {
          finish(null, parseDshWebUrl(line));
        } catch (error) {
          finish(error);
        }
      };
      const onError = (error) => finish(error);
      const onExit = (code, signal) => finish(new Error(
        `dsh web exited before readiness (code=${code}, signal=${signal})\n${output.value()}`,
      ));

      child.once("error", onError);
      child.once("exit", onExit);
      consumeLines(child.stdout, inspectLine);
      consumeLines(child.stderr, inspectLine);
    });
    return { child, url, output };
  } catch (error) {
    // Do not let the caller delete DSH_HOME until the failed child has been
    // fully reaped; otherwise teardown races a still-running Host process.
    await forceStopWeb({ child, url: null, output });
    throw error;
  }
}

async function stopWeb(instance) {
  let outcome = exitedOutcome(instance.child);
  if (outcome === null) {
    instance.child.kill("SIGINT");
    outcome = await waitForExit(instance.child, STOP_TIMEOUT_MS);
  }
  if (outcome === null) {
    instance.child.kill("SIGKILL");
    await waitForExit(instance.child, 5_000);
    throw new Error(`dsh web did not stop gracefully after SIGINT\n${instance.output.value()}`);
  }
  assertGracefulSigintExit(outcome);
}

async function forceStopWeb(instance) {
  if (exitedOutcome(instance.child) !== null || instance.child.pid === undefined) return;
  instance.child.kill("SIGTERM");
  if (await waitForExit(instance.child, 5_000) !== null) return;
  instance.child.kill("SIGKILL");
  if (await waitForExit(instance.child, 5_000) === null) {
    throw new Error(`Unable to reap dsh web child\n${instance.output.value()}`);
  }
}

function waitForExit(child, timeoutMs) {
  const existing = exitedOutcome(child);
  if (existing !== null) return Promise.resolve(existing);
  return new Promise((resolveExit) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolveExit(null);
    }, timeoutMs);
    const onExit = (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    };
    child.once("exit", onExit);
  });
}

function exitedOutcome(child) {
  return child.exitCode !== null || child.signalCode !== null
    ? { code: child.exitCode, signal: child.signalCode }
    : null;
}

async function holdLoopbackPort(webUrl) {
  const port = Number(new URL(webUrl).port);
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => rejectListen(error);
    server.once("error", onError);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.off("error", onError);
      resolveListen();
    });
  });
  return server;
}

function closeServer(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error === undefined) resolveClose();
      else rejectClose(error);
    });
  });
}

function runCommand(invocation, args, environment, timeoutMs) {
  const commandArgs = [...invocation.prefixArgs, ...args];
  const child = spawn(invocation.command, commandArgs, {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = createBoundedOutput();
  const stderr = createBoundedOutput();
  child.stdout.on("data", (chunk) => stdout.append(chunk));
  child.stderr.on("data", (chunk) => stderr.append(chunk));

  return new Promise((resolveRun, rejectRun) => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      const result = { stdout: stdout.value(), stderr: stderr.value() };
      if (!timedOut && code === 0) resolveRun(result);
      else rejectRun(new Error([
        `${invocation.command} ${commandArgs.join(" ")} failed ` +
          `(code=${code}, signal=${signal}, timeout=${timedOut})`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n")));
    });
  });
}

async function requestText(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.text();
    if (response.status !== 200) {
      throw new Error(`${label} returned HTTP ${response.status}: ${body.slice(0, 500)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson(url, init, label) {
  const text = await requestText(url, init, label);
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`${label} did not return JSON`, { cause });
  }
}

function snapshotFromEnvelope(envelope, label) {
  if (!isRecord(envelope) || !isRecord(envelope.snapshot)) {
    throw new Error(`${label} did not return a snapshot envelope`);
  }
  snapshotNumbers(envelope.snapshot, label);
  return envelope.snapshot;
}

function snapshotNumbers(snapshot, label) {
  if (
    !isRecord(snapshot) ||
    !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
    !Number.isSafeInteger(snapshot.wallet) || snapshot.wallet < 0
  ) {
    throw new Error(`${label} has invalid wallet or revision`);
  }
  return { revision: snapshot.revision, wallet: snapshot.wallet };
}

function assertExactDshVersion(output) {
  const escaped = escapeRegExp(DSH_VERSION);
  if (!new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(String(output))) {
    throw new Error(`Expected official @deepseek-ai/dsh ${DSH_VERSION}, received ${output.trim()}`);
  }
}

function parseArguments(args) {
  const result = {
    dsh: "dsh",
    dshEntry: undefined,
    tgz: defaultPluginArchive(),
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    if (flag === "--dsh") result.dsh = value;
    else if (flag === "--dsh-entry") result.dshEntry = value;
    else if (flag === "--tgz") result.tgz = value;
    else throw new Error(`Unknown argument ${flag}`);
  }
  return result;
}

export function defaultPluginArchive() {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  );
  if (
    !isRecord(manifest) ||
    typeof manifest.name !== "string" || manifest.name === "" ||
    typeof manifest.version !== "string" || manifest.version === ""
  ) {
    throw new Error("package.json must contain a non-empty name and version");
  }
  return `./${manifest.name}-${manifest.version}.tgz`;
}

export function createDshInvocation(command, entry, nodeExecutable = process.execPath) {
  return entry === undefined
    ? { command, prefixArgs: [] }
    : { command: nodeExecutable, prefixArgs: [resolve(entry)] };
}

function consumeLines(stream, onLine) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) onLine(line);
  });
  stream.on("end", () => {
    if (pending !== "") onLine(pending);
  });
}

function createBoundedOutput() {
  let text = "";
  return {
    append(chunk) {
      text += String(chunk);
      if (Buffer.byteLength(text) > MAX_OUTPUT_BYTES) {
        text = text.slice(-MAX_OUTPUT_BYTES);
      }
    },
    value() {
      return text;
    },
  };
}

function readBalancedObject(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("Root DSH boot manifest JSON is not balanced");
}

function yamlScalar(value) {
  const withoutComment = value.replace(/\s+#.*$/, "").trim();
  if (
    withoutComment.length >= 2 &&
    ((withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
      (withoutComment.startsWith("'") && withoutComment.endsWith("'")))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
