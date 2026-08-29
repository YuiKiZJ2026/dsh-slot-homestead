// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { resolve } from "node:path";
import {
  sourceArchiveArguments,
  sourceArchivePaths,
  validateArchiveEntries,
  validateTrackedPaths,
} from "../../scripts/build-source.mjs";
import { describe, expect, it } from "vitest";

// @ts-expect-error Node globals are available in Vitest; browser-facing typecheck omits @types/node.
const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

const REQUIRED = [
  "LICENSE",
  "README.md",
  "cordis.patch.yml",
  "package-lock.json",
  "package.json",
  "scripts/build-plugin.mjs",
  "scripts/build-source.mjs",
  "src/plugin/shared/contracts.ts",
  "tsconfig.json",
] as const;

describe("release source archive", () => {
  it("derives the fixed release name and prefix and filters generated or private roots", () => {
    expect(sourceArchivePaths("0.2.0")).toEqual({
      archiveName: "dsh-desktop-slot-widget-0.2.0-source.zip",
      prefix: "dsh-desktop-slot-widget-0.2.0/",
    });

    const included = validateTrackedPaths([
      ...REQUIRED,
      ".gitattributes",
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      ".github/workflows/ci.yml",
      "docs/guide.md",
      "public/assets/scene-base.png",
      "src/plugin/client/assets/scene-base.png",
      "tests/app-flow.spec.ts",
      ".superpowers/internal.md",
      ".research/notes.md",
      "assets/generated.png",
      "lib/index.js",
      "node_modules/dependency/index.js",
      "test-results/failure.png",
      "tmp/work.txt",
      "dist/app.js",
      "dsh-desktop-slot-widget-0.2.0.tgz",
    ]);

    expect(included).toContain("src/plugin/client/assets/scene-base.png");
    expect(included).toContain("public/assets/scene-base.png");
    expect(included).toContain("CHANGELOG.md");
    expect(included).toContain("CONTRIBUTING.md");
    expect(included).toContain("SECURITY.md");
    expect(included).not.toContain("assets/generated.png");
    expect(included).not.toContain(".superpowers/internal.md");
    expect(included).not.toContain("dsh-desktop-slot-widget-0.2.0.tgz");
  });

  it("archives one resolved commit OID instead of re-reading symbolic HEAD", () => {
    const commit = "0123456789abcdef0123456789abcdef01234567";
    const args = sourceArchiveArguments(
      commit,
      "dsh-desktop-slot-widget-0.2.0/",
      "/release/source.zip",
      ["README.md", "src/index.ts"],
    );

    expect(args).toEqual([
      "archive",
      "--format=zip",
      "--prefix=dsh-desktop-slot-widget-0.2.0/",
      "--output=/release/source.zip",
      commit,
      "--",
      "README.md",
      "src/index.ts",
    ]);
    expect(args).not.toContain("HEAD");
  });

  it("fails closed for an unreviewed tracked root or unsafe path", () => {
    expect(() => validateTrackedPaths([...REQUIRED, "secrets.txt"]))
      .toThrow(/allowlist/i);
    expect(() => validateTrackedPaths([...REQUIRED, "../outside.txt"]))
      .toThrow(/unsafe/i);
  });

  it("validates the archive as the exact prefixed allowlisted file set", () => {
    const prefix = "dsh-desktop-slot-widget-0.2.0/";
    const included = [...REQUIRED];
    const entries = [prefix, ...included.map((path) => `${prefix}${path}`)];

    expect(() => validateArchiveEntries(entries, included, prefix)).not.toThrow();
    expect(() => validateArchiveEntries(
      [...entries, `${prefix}lib/index.js`],
      included,
      prefix,
    )).toThrow(/exact/i);
    expect(() => validateArchiveEntries(entries.slice(0, -1), included, prefix))
      .toThrow(/exact/i);
    expect(() => validateArchiveEntries(["wrong/file.ts"], included, prefix))
      .toThrow(/prefix/i);
  });

  it("keeps source release explicit and independent from the normal package build", () => {
    const manifest = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const source = read("scripts/build-source.mjs");

    expect(manifest.scripts["build:source"]).toBe("node scripts/build-source.mjs");
    expect(manifest.scripts.build).toBe("node scripts/build-plugin.mjs");
    expect(manifest.scripts.build).not.toContain("build:source");
    expect(source).toContain('"archive", "--format=zip"');
    expect(source).toContain('"rev-parse", "--verify", "HEAD^{commit}"');
    expect(source).toContain('`${commit}:package.json`');
    expect(source).not.toMatch(/\["rev-parse", "HEAD"\]|"archive"[\s\S]*?"HEAD"/);
    expect(source).toContain('resolve(root, "..", archiveName)');
    expect(source).not.toContain('execFileSync("unzip"');
  });
});
