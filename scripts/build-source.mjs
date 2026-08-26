#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "dsh-desktop-slot-widget";
const INCLUDED_ROOTS = new Set([
  ".github",
  "docs",
  "public",
  "scripts",
  "src",
  "tests",
]);
const INCLUDED_FILES = new Set([
  ".gitignore",
  "LICENSE",
  "README.md",
  "cordis.patch.yml",
  "design-qa.md",
  "index.html",
  "native-preview.html",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "tsconfig.json",
  "tsconfig.plugin.json",
  "vite.config.ts",
  "vite.plugin.config.ts",
  "vitest.setup.ts",
]);
const EXCLUDED_ROOTS = new Set([
  ".git",
  ".plugin-build",
  ".research",
  ".superpowers",
  "assets",
  "dist",
  "lib",
  "node_modules",
  "test-results",
  "tmp",
]);
const REQUIRED_FILES = [
  "LICENSE",
  "README.md",
  "cordis.patch.yml",
  "package-lock.json",
  "package.json",
  "scripts/build-plugin.mjs",
  "scripts/build-source.mjs",
  "src/plugin/shared/contracts.ts",
  "tsconfig.json",
];

export function sourceArchivePaths(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version))) {
    throw new Error(`Invalid release version: ${version}`);
  }
  return {
    archiveName: `${PACKAGE_NAME}-${version}-source.zip`,
    prefix: `${PACKAGE_NAME}-${version}/`,
  };
}

export function sourceArchiveArguments(commit, prefix, output, includedPaths) {
  if (!/^[0-9a-f]{40,64}$/.test(String(commit))) {
    throw new Error(`Invalid resolved source commit OID: ${commit}`);
  }
  return [
    "archive", "--format=zip",
    `--prefix=${prefix}`,
    `--output=${output}`,
    commit,
    "--",
    ...includedPaths,
  ];
}

export function validateTrackedPaths(paths) {
  const included = [];
  const unexpected = [];
  const seen = new Set();
  for (const candidate of paths) {
    const path = String(candidate);
    assertSafeRepositoryPath(path);
    if (seen.has(path)) throw new Error(`Duplicate tracked source path: ${path}`);
    seen.add(path);

    const root = path.split("/", 1)[0];
    if (EXCLUDED_ROOTS.has(root) || path.endsWith(".tgz")) continue;
    if (INCLUDED_FILES.has(path) || INCLUDED_ROOTS.has(root)) included.push(path);
    else unexpected.push(path);
  }

  if (unexpected.length > 0) {
    throw new Error(`Tracked paths are outside the source allowlist:\n${unexpected.sort().join("\n")}`);
  }
  const missing = REQUIRED_FILES.filter((path) => !included.includes(path));
  if (missing.length > 0) {
    throw new Error(`Source allowlist is missing required tracked files:\n${missing.join("\n")}`);
  }
  return included.sort();
}

export function validateArchiveEntries(entries, includedPaths, prefix) {
  if (!prefix.endsWith("/") || prefix.startsWith("/") || prefix.includes("..")) {
    throw new Error(`Unsafe source archive prefix: ${prefix}`);
  }
  const normalized = entries.filter((entry) => entry !== "");
  const outside = normalized.filter((entry) => !entry.startsWith(prefix));
  if (outside.length > 0) {
    throw new Error(`Source archive entry escaped the release prefix: ${outside[0]}`);
  }

  const actualFiles = normalized.filter((entry) => !entry.endsWith("/")).sort();
  const expectedFiles = includedPaths.map((path) => `${prefix}${path}`).sort();
  if (actualFiles.join("\n") !== expectedFiles.join("\n")) {
    throw new Error([
      "Source archive does not contain the exact allowlisted file set",
      `expected ${expectedFiles.length} files; received ${actualFiles.length}`,
    ].join("\n"));
  }
}

export function readZipEntries(path) {
  const archive = readFileSync(path);
  const minimumEocdSize = 22;
  const maximumCommentSize = 65_535;
  const earliestEocd = Math.max(0, archive.length - minimumEocdSize - maximumCommentSize);
  let eocd = -1;

  for (let offset = archive.length - minimumEocdSize; offset >= earliestEocd; offset -= 1) {
    if (
      archive.readUInt32LE(offset) === 0x06054b50 &&
      offset + minimumEocdSize + archive.readUInt16LE(offset + 20) === archive.length
    ) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Source archive has no valid ZIP end record");

  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const diskEntries = archive.readUInt16LE(eocd + 8);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (
    disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount ||
    entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff
  ) {
    throw new Error("Source archive uses unsupported multi-disk or ZIP64 metadata");
  }
  if (centralOffset + centralSize > eocd) {
    throw new Error("Source archive central directory is outside the ZIP payload");
  }

  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory entry ${index}`);
    }
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > archive.length) {
      throw new Error(`Truncated ZIP central directory entry ${index}`);
    }
    entries.push(archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset = nextOffset;
  }
  if (offset !== centralOffset + centralSize) {
    throw new Error("Source archive central directory size does not match its entries");
  }
  return entries;
}

function assertSafeRepositoryPath(path) {
  const segments = path.split("/");
  if (
    path === "" ||
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe tracked source path: ${path}`);
  }
}

function git(root, args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1_024 * 1_024,
    ...options,
  });
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const gitRoot = resolve(git(root, ["rev-parse", "--show-toplevel"]).trim());
  if (gitRoot !== root) throw new Error(`Source release must run at repository root ${root}`);

  const commit = git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  const manifest = JSON.parse(git(root, ["show", `${commit}:package.json`]));
  if (manifest.name !== PACKAGE_NAME) {
    throw new Error(`Tracked HEAD package name must be ${PACKAGE_NAME}`);
  }
  const { archiveName, prefix } = sourceArchivePaths(manifest.version);
  const tracked = git(root, ["ls-tree", "-r", "--name-only", "-z", commit])
    .split("\0")
    .filter(Boolean);
  const included = validateTrackedPaths(tracked);
  const output = resolve(root, "..", archiveName);
  const temporary = `${output}.tmp-${process.pid}`;

  try {
    rmSync(temporary, { force: true });
    git(root, sourceArchiveArguments(commit, prefix, temporary, included), {
      encoding: null,
    });
    const entries = readZipEntries(temporary);
    validateArchiveEntries(entries, included, prefix);
    rmSync(output, { force: true });
    renameSync(temporary, output);
  } finally {
    rmSync(temporary, { force: true });
  }

  console.log(`source archive: ${output}`);
  console.log(`tracked commit: ${commit}`);
  console.log(`allowlisted files: ${included.length}`);
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
