// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDshInvocation,
  defaultPluginArchive,
} from "../../scripts/dsh-real-smoke.mjs";

// @ts-expect-error Node globals are available in Vitest; browser-facing typecheck omits @types/node.
const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

describe("real DSH CI gate contract", () => {
  it("installs pinned pnpm and DSH on pinned Linux before running the version-aware smoke", () => {
    const workflow = read(".github/workflows/ci.yml");

    expect(workflow).toContain("real-dsh-smoke:");
    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toMatch(/pnpm\/action-setup@v4[\s\S]*version:\s*11\.7\.0/);
    expect(workflow).toContain(
      'pnpm add --dir "$RUNNER_TEMP/dsh-cli" --save-exact @deepseek-ai/dsh@0.1.1-rc.2',
    );
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain(
      'node scripts/dsh-real-smoke.mjs --dsh-entry "$RUNNER_TEMP/dsh-cli/node_modules/@deepseek-ai/dsh/lib/bin.js"',
    );
    expect(workflow).not.toContain("--tgz ./dsh-desktop-slot-widget-");
    expect(workflow).not.toMatch(/npx\s+@deepseek-ai\/dsh|pnpm\s+dlx/);
    expect(workflow).not.toContain("pnpm add --global");
  });

  it("derives the default archive from the current package manifest", () => {
    const manifest = JSON.parse(read("package.json"));

    expect(defaultPluginArchive()).toBe(`./${manifest.name}-${manifest.version}.tgz`);
  });

  it("holds the old port and reaps failed starts before isolated-home teardown", () => {
    const smoke = read("scripts/dsh-real-smoke.mjs");

    expect(smoke).toMatch(/heldRestartPort\s*=\s*await holdLoopbackPort\(firstUrl\)/);
    expect(smoke).toContain("assertDifferentWebPort(firstUrl, activeWeb.url)");
    expect(smoke).toMatch(/catch \(error\) \{[\s\S]*await forceStopWeb\([\s\S]*throw error/);
    expect(smoke).toContain("assertGracefulSigintExit(outcome)");
  });

  it("can invoke a pinned DSH JavaScript entry directly on Windows", () => {
    const entry = resolve(root, ".dsh-smoke-cli", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");

    expect(createDshInvocation("dsh", undefined, "node")).toEqual({
      command: "dsh",
      prefixArgs: [],
    });
    expect(createDshInvocation("ignored", entry, "node")).toEqual({
      command: "node",
      prefixArgs: [entry],
    });
  });
});
