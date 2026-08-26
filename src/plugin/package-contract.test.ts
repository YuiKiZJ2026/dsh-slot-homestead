// @ts-expect-error Node built-ins are available at runtime; this browser project intentionally omits @types/node.
import { execFileSync } from "node:child_process";
// @ts-expect-error Node built-ins are available at runtime; this browser project intentionally omits @types/node.
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available at runtime; this browser project intentionally omits @types/node.
import { dirname, relative, resolve, sep } from "node:path";
// @ts-expect-error Node built-ins are available at runtime; this browser project intentionally omits @types/node.
import { runInNewContext } from "node:vm";
import { decode } from "@jridgewell/sourcemap-codec";
import { describe, expect, it } from "vitest";
import { isClientExternal, isHostExternal } from "./build-externals";

// @ts-expect-error Node globals are available in Vitest; this browser project intentionally omits @types/node.
const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

interface FlatSourceMap {
  version: number;
  sources: string[];
  sourcesContent?: Array<string | null>;
  mappings: string;
}

function assertAuditableSources(mapPath: string, map: FlatSourceMap): void {
  expect(map.sources.length).toBeGreaterThan(0);
  expect(map.sourcesContent === undefined || map.sourcesContent.length === map.sources.length).toBe(true);

  for (const [index, source] of map.sources.entries()) {
    const absolute = resolve(dirname(mapPath), source);
    expect(relative(root, absolute).split(sep)).not.toContain("..");
    const embedded = map.sourcesContent?.[index];
    expect(existsSync(absolute) || (typeof embedded === "string" && embedded.length > 0), source).toBe(true);
  }
}

describe("published DSH bundle contract", () => {
  it("externalizes only approved module words for each build face", () => {
    expect(["react", "react/jsx-runtime"].filter(isClientExternal)).toEqual([
      "react",
      "react/jsx-runtime",
    ]);
    for (const rejected of [
      "react/client",
      "react-dom",
      "@deepseek-ai/dsh-client-runtime/client",
      "@deepseek-ai/dsh-client-ui-conversation/client",
      "@deepseek-ai/dsh-storage-domain",
    ]) {
      expect(isClientExternal(rejected), rejected).toBe(false);
    }

    expect(isHostExternal("@deepseek-ai/cordis")).toBe(true);
    expect(isHostExternal("@deepseek-ai/dsh-storage-domain/client")).toBe(true);
    expect(isHostExternal("react")).toBe(false);
  });

  it("declares the approved package, runtime, and DSH metadata", () => {
    const manifest = JSON.parse(read("package.json"));

    expect(manifest).toMatchObject({
      name: "dsh-desktop-slot-widget",
      version: "0.2.0",
      type: "module",
      main: "./lib/index.js",
      files: ["lib", "assets", "cordis.patch.yml", "README.md", "LICENSE"],
      exports: {
        ".": {
          types: "./lib/types/index.d.ts",
          default: "./lib/index.js",
        },
        "./client": {
          types: "./lib/types/client/index.d.ts",
          default: "./lib/client.js",
        },
        "./package.json": "./package.json",
      },
      engines: { node: "^22.22.2 || >=24.15.0" },
      packageManager: "pnpm@11.7.0",
      license: "ISC",
      author: "DSH Desktop Slot contributors",
      description: "A pixel-art slot companion plugin for DSH Desktop.",
      keywords: ["deepseek-harness", "dsh", "dsh-desktop", "plugin", "slot-widget"],
      peerDependencies: {
        "@deepseek-ai/cordis": "^4.0.1",
        "@deepseek-ai/dsh-client-runtime": "0.1.1-rc.2",
        "@deepseek-ai/dsh-client-ui-conversation": "0.1.1-rc.2",
        "@deepseek-ai/dsh-host-webserver": "0.1.1-rc.2",
        "@deepseek-ai/dsh-session": "0.1.1-rc.2",
        "@deepseek-ai/dsh-storage-domain": "0.1.1-rc.2",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      dsh: {
        bundle: { patch: "./cordis.patch.yml" },
        client: {
          platform: "web",
          inject: ["@deepseek-ai/dsh-client-ui-conversation"],
        },
      },
    });
    expect(manifest).not.toHaveProperty("repository");
  });

  it("ships the ISC license and the minimal Cordis insertion", () => {
    expect(read("LICENSE")).toContain("ISC License");
    expect(read("LICENSE")).toContain("Permission to use, copy, modify, and/or distribute");
    expect(read("cordis.patch.yml")).toBe(
      "- insert:\n    - id: dsh-desktop-slot-widget\n      name: dsh-desktop-slot-widget\n",
    );
  });

  it("registers lazy-CJS before explicitly materializing the client factory", () => {
    const clientPath = resolve(root, "lib/client.js");
    expect(existsSync(clientPath)).toBe(true);
    const source = read("lib/client.js");
    const registrations: unknown[] = [];

    runInNewContext(source, {
      window: {
        __ModuleLoader__: {
          load(registration: unknown) {
            registrations.push(registration);
          },
        },
      },
    });

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject({
      id: "dsh-desktop-slot-widget",
      factory: expect.any(Function),
    });
    expect(source.trimStart()).toMatch(/^window\.__ModuleLoader__\.load\(\{/);
    expect(source).toContain("factory(require)");

    const registration = registrations[0] as {
      factory: (require: (id: string) => Record<string, unknown>) => Record<string, unknown>;
    };
    const requireIds: string[] = [];
    const exports = registration.factory((id) => {
      requireIds.push(id);
      return {};
    });
    expect(requireIds.sort()).toEqual(["react", "react/jsx-runtime"]);
    expect(Object.keys(exports).sort()).toEqual(["SlotWidgetView", "apply", "inject"]);
  });

  it("keeps production bundles free of preview-only authorities", () => {
    const production = `${read("lib/index.js")}\n${read("lib/client.js")}`;
    for (const forbidden of [
      "MockDshAdapter",
      "打开演示控制台",
      "localStorage",
      "FixedClock",
      "navigator.locks",
      "dsh-slot-economy",
    ]) {
      expect(production, forbidden).not.toContain(forbidden);
    }
  });

  it("publishes standalone entry declarations with readable source maps", () => {
    for (const [declaration, source, sourceFile] of [
      ["lib/types/index.d.ts", "../../src/plugin/host/index.ts", "src/plugin/host/index.ts"],
      ["lib/types/client/index.d.ts", "../../../src/plugin/client/index.tsx", "src/plugin/client/index.tsx"],
    ]) {
      const facade = read(declaration);
      expect(facade).toContain("export declare function apply");
      expect(facade).not.toMatch(/(?:from|import\()["']\.\.?\//);
      const map = JSON.parse(read(`${declaration}.map`));
      expect(map).toMatchObject({ version: 3, sources: [source] });
      expect(map.sourcesContent).toEqual([read(sourceFile)]);
      assertAuditableSources(resolve(root, `${declaration}.map`), map);
    }

    const clientMapPath = resolve(root, "lib/client.js.map");
    const clientMap = JSON.parse(read("lib/client.js.map"));
    expect(clientMap).toMatchObject({
      version: 3,
      file: "client.js",
      sections: [{ offset: { line: 5, column: 0 } }],
    });
    expect(clientMap.sections).toHaveLength(1);
    const bodyMap = clientMap.sections[0].map as FlatSourceMap;
    expect(bodyMap.sources).toContain("../src/plugin/client/index.tsx");
    assertAuditableSources(clientMapPath, bodyMap);

    const decoded = decode(bodyMap.mappings);
    const mappedSegments = decoded.flat().filter((segment) => segment.length >= 4);
    expect(mappedSegments.length).toBeGreaterThan(0);
    for (const segment of mappedSegments) {
      expect(segment[1]).toBeGreaterThanOrEqual(0);
      expect(segment[1]).toBeLessThan(bodyMap.sources.length);
    }
  });

  it("packs only the audited runtime and documentation allowlist", () => {
    const archive = resolve(root, "dsh-desktop-slot-widget-0.2.0.tgz");
    expect(existsSync(archive)).toBe(true);
    const output = execFileSync("tar", ["-tzf", archive], {
      cwd: root,
      encoding: "utf8",
    });
    const paths = output.trim().split(/\r?\n/).map((path: string) => path.replace(/^package\//, "")).sort();

    expect(paths).toEqual([
      "LICENSE",
      "README.md",
      "assets/collectibles.png",
      "assets/reel-symbols-runtime.png",
      "assets/scene-base.png",
      "cordis.patch.yml",
      "lib/client.js",
      "lib/client.js.map",
      "lib/index.js",
      "lib/index.js.map",
      "lib/types/client/index.d.ts",
      "lib/types/client/index.d.ts.map",
      "lib/types/index.d.ts",
      "lib/types/index.d.ts.map",
      "package.json",
    ]);
  });
});
