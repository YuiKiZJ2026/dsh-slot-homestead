import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staging = resolve(root, ".plugin-build");
const lib = resolve(root, "lib");
const assets = resolve(root, "assets");
const companion = resolve(root, "companion");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const archive = resolve(root, `dsh-desktop-slot-widget-${manifest.version}.tgz`);
const configFile = resolve(root, "vite.plugin.config.ts");
const shouldPack = !process.argv.includes("--skip-pack");

rmSync(staging, { force: true, recursive: true });
rmSync(lib, { force: true, recursive: true });
rmSync(assets, { force: true, recursive: true });
rmSync(companion, { force: true, recursive: true });
if (shouldPack) rmSync(archive, { force: true });
mkdirSync(lib, { recursive: true });

await build({ configFile, mode: "plugin-host" });
await build({ configFile, mode: "plugin-client" });
await build({ configFile, mode: "plugin-companion" });

const clientDir = resolve(staging, "client");
const clientFiles = readdirSync(clientDir).sort();
if (clientFiles.join("\n") !== "client-body.cjs\nclient-body.cjs.map") {
  throw new Error(`Client build emitted unexpected runtime sidecars:\n${clientFiles.join("\n")}`);
}

const clientBodyPath = resolve(clientDir, "client-body.cjs");
const clientBody = readFileSync(clientBodyPath, "utf8")
  .replace(/\n?\/\/# sourceMappingURL=client-body\.cjs\.map\s*$/, "");
const bodyMap = JSON.parse(readFileSync(`${clientBodyPath}.map`, "utf8"));
if (bodyMap.sourceRoot !== undefined && bodyMap.sourceRoot !== "") {
  throw new Error(`Unexpected client source-map root: ${bodyMap.sourceRoot}`);
}
bodyMap.sources = bodyMap.sources.map((source) => mapRelativePath(lib, resolve(clientDir, source)));
const wrapperPrefix = [
  "window.__ModuleLoader__.load({",
  "  id: 'dsh-desktop-slot-widget',",
  "  factory(require) {",
  "    const module = { exports: {} }",
  "    const exports = module.exports",
].join("\n");
const wrapperSuffix = [
  "    return module.exports",
  "  },",
  "})",
  "//# sourceMappingURL=client.js.map",
  "",
].join("\n");
writeFileSync(resolve(lib, "client.js"), `${wrapperPrefix}\n${clientBody}\n${wrapperSuffix}`);
writeFileSync(resolve(lib, "client.js.map"), JSON.stringify({
  version: 3,
  file: "client.js",
  sections: [{ offset: { line: 5, column: 0 }, map: bodyMap }],
}));

execFileSync(process.execPath, [resolve(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.plugin.json"], {
  cwd: root,
  stdio: "inherit",
});
copyDeclaration("plugin/host/index.d.ts", "index.d.ts", resolve(root, "src/plugin/host/index.ts"));
copyDeclaration("plugin/client/index.d.ts", "client/index.d.ts", resolve(root, "src/plugin/client/index.tsx"));

mkdirSync(assets, { recursive: true });
for (const name of [
  "collectibles.png",
  "ecosystem-animal-lifecycle-atlas-v2.svg",
  "ecosystem-animal-produce-atlas-v2.svg",
  "ecosystem-reference-aquarium.png",
  "ecosystem-arrow.png",
  "ecosystem-bubbles.png",
  "ecosystem-crop-lifecycle-atlas-v2.svg",
  "ecosystem-fish-lifecycle-atlas-v2.svg",
  "ecosystem-garden-bed-v3.png",
  "ecosystem-garden-watering-can-v3.png",
  "ecosystem-night-aquarium-lamp.png",
  "ecosystem-night-garden-lamp.png",
  "ecosystem-night-pasture-lamp.png",
  "ecosystem-reference-pasture.png",
  "ecosystem-scarecrow.png",
  "ecosystem-slot-equipment-v3.png",
  "ecosystem-water-plant.png",
  "ecosystem-workbench-table-v3.png",
  "reel-symbols-runtime.png",
  "scene-base.png",
]) {
  cpSync(resolve(root, "src/plugin/client/assets", name), resolve(assets, name));
}
mkdirSync(companion, { recursive: true });
writeFileSync(resolve(companion, "index.html"), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' file: data:; connect-src http://127.0.0.1:* http://localhost:*;">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DSH 桌面老虎机</title>
  <style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}</style>
</head>
<body><div id="root"></div><script src="../lib/companion.js"></script></body>
</html>
`);

assertFiles(lib, [
  "client.js",
  "client.js.map",
  "companion.js",
  "companion.js.map",
  "index.js",
  "index.js.map",
  "types/client/index.d.ts",
  "types/client/index.d.ts.map",
  "types/index.d.ts",
  "types/index.d.ts.map",
]);
rmSync(staging, { force: true, recursive: true });
if (shouldPack) await packOffline();
assertFiles(lib, [
  "client.js",
  "client.js.map",
  "companion.js",
  "companion.js.map",
  "index.js",
  "index.js.map",
  "types/client/index.d.ts",
  "types/client/index.d.ts.map",
  "types/index.d.ts",
  "types/index.d.ts.map",
]);

async function packOffline() {
  const require = createRequire(import.meta.url);
  const npmPackPath = [
    process.env.CODEX_PRIMARY_RUNTIME_ROOT === undefined
      ? ""
      : resolve(process.env.CODEX_PRIMARY_RUNTIME_ROOT, "dependencies/node/lib/node_modules/npm/node_modules/libnpmpack"),
    resolve(dirname(process.execPath), "../lib/node_modules/npm/node_modules/libnpmpack"),
    resolve(dirname(process.execPath), "node_modules/npm/node_modules/libnpmpack"),
  ].find(existsSync);
  if (npmPackPath === undefined) {
    throw new Error("The npm-bundled libnpmpack API is required for the offline package build");
  }
  const npmPack = require(npmPackPath);
  await npmPack(`file:${root}`, {
    dryRun: false,
    ignoreScripts: true,
    offline: true,
    packDestination: root,
  });
}

function copyDeclaration(sourceName, targetName, originalSource) {
  const source = resolve(staging, "types", sourceName);
  const target = resolve(lib, "types", targetName);
  const map = JSON.parse(readFileSync(`${source}.map`, "utf8"));
  map.file = targetName.split("/").at(-1);
  map.sources = [mapRelativePath(dirname(`${target}.map`), originalSource)];
  map.sourcesContent = [readFileSync(originalSource, "utf8")];
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(source, "utf8"));
  writeFileSync(`${target}.map`, JSON.stringify(map));
}

function mapRelativePath(fromDirectory, target) {
  return relative(fromDirectory, target).split(sep).join("/");
}

function assertFiles(directory, expected) {
  const actual = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => mapRelativePath(directory, resolve(entry.parentPath, entry.name)))
    .sort();
  if (actual.join("\n") !== expected.sort().join("\n")) {
    throw new Error(`Unexpected files in ${directory}:\n${actual.join("\n")}`);
  }
}
