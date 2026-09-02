#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = readJson("package.json");
const lockfile = readJson("package-lock.json");
const expectedPackageManager = "npm@11.9.0";
const expectedTag = `v${manifest.version}`;
const requestedTag = readOption("--tag") ?? process.env.GITHUB_REF_NAME;
const failures = [];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(String(manifest.version))) {
  failures.push(`package.json has an invalid release version: ${manifest.version}`);
}
if (lockfile.version !== manifest.version || lockfile.packages?.[""]?.version !== manifest.version) {
  failures.push("package-lock.json root versions do not match package.json");
}
if (manifest.packageManager !== expectedPackageManager) {
  failures.push(`packageManager must be ${expectedPackageManager}`);
}
for (const path of ["lib", "assets", "companion", "cordis.patch.yml", "ASSETS.md", "README.md", "LICENSE"]) {
  if (!manifest.files?.includes(path)) failures.push(`package files allowlist is missing ${path}`);
}
if (requestedTag !== undefined && requestedTag !== expectedTag) {
  failures.push(`release tag ${requestedTag} does not match ${expectedTag}`);
}

const assetNotice = read("ASSETS.md");
const rightsStatus = /ASSET_RIGHTS_STATUS:\s*([a-z-]+)/i.exec(assetNotice)?.[1];
if (rightsStatus !== "confirmed") {
  failures.push("visual asset rights are not confirmed in ASSETS.md");
}

for (const path of [
  "ASSETS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  "design-qa.md",
]) {
  const source = read(path);
  if (/(?:[A-Za-z]:\\(?:Users|Documents|Desktop|AppData|codex)\\|\/Users\/|\/home\/)/i.test(source)) {
    failures.push(`${path} contains a private absolute filesystem path`);
  }
}

if (failures.length > 0) {
  throw new Error(`Release metadata check failed:\n- ${failures.join("\n- ")}`);
}

console.log(`release metadata passed for ${manifest.name}@${manifest.version}`);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
