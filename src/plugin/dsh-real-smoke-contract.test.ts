// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDshInvocation,
  defaultPluginArchive,
  parseArguments,
} from "../../scripts/dsh-real-smoke.mjs";

// @ts-expect-error Node globals are available in Vitest; browser-facing typecheck omits @types/node.
const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

describe("real DSH CI gate contract", () => {
  it("installs pinned pnpm and DSH on pinned Linux before running the version-aware smoke", () => {
    const workflow = read(".github/workflows/ci.yml");
    const releaseWorkflow = read(".github/workflows/release.yml");
    const buildPolicy = read(".github/dsh-cli-pnpm-workspace.yaml");
    const copyBuildPolicy =
      'cp .github/dsh-cli-pnpm-workspace.yaml "$RUNNER_TEMP/dsh-cli/pnpm-workspace.yaml"';
    const installDsh =
      'pnpm add --dir "$RUNNER_TEMP/dsh-cli" --save-exact @deepseek-ai/dsh@0.1.1-rc.2';
    const runSmoke =
      'node scripts/dsh-real-smoke.mjs --dsh-entry "$RUNNER_TEMP/dsh-cli/node_modules/@deepseek-ai/dsh/lib/bin.js"';

    expect(workflow).toContain("real-dsh-smoke:");
    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toMatch(/pnpm\/action-setup@v4[\s\S]*version:\s*11\.7\.0/);
    expect(workflow).toContain(copyBuildPolicy);
    expect(workflow).toContain(installDsh);
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain(runSmoke);
    expect(workflow).not.toContain("--tgz ./dsh-slot-homestead-");
    expect(workflow).not.toMatch(/npx\s+@deepseek-ai\/dsh|pnpm\s+dlx/);
    expect(workflow).not.toContain("pnpm add --global");

    expect(releaseWorkflow).toMatch(/pnpm\/action-setup@v4[\s\S]*version:\s*11\.7\.0/);
    expect(releaseWorkflow).toContain(copyBuildPolicy);
    expect(releaseWorkflow).toContain(installDsh);
    expect(releaseWorkflow).toContain(runSmoke);
    for (const dependency of [
      "@deepseek-ai/dsh-subprocess-local@0.1.1-rc.2",
      "@google/genai@1.52.0",
      "koffi@3.1.6",
      "node-pty@1.2.0-beta.15",
      "protobufjs@7.6.6",
    ]) {
      expect(buildPolicy).toContain(`'${dependency}': true`);
    }
  });

  it("derives the default archive from the current package manifest", () => {
    const manifest = JSON.parse(read("package.json"));

    expect(defaultPluginArchive()).toBe(`./${manifest.name}-${manifest.version}.tgz`);
    expect(parseArguments(["--upgrade-from", "./legacy.tgz"])).toMatchObject({
      tgz: `./${manifest.name}-${manifest.version}.tgz`,
      upgradeFrom: "./legacy.tgz",
    });
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
