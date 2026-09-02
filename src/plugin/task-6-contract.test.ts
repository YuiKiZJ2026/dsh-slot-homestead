// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error Node globals are available in Vitest; browser-facing typecheck omits @types/node.
const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

describe("Task 6 browser CI and visual contracts", () => {
  it("runs functional browser E2E after Chromium install and uploads failures", () => {
    const workflow = read(".github/workflows/ci.yml");
    const install = workflow.indexOf("npx playwright install chromium");
    const functional = workflow.indexOf(
      "npx playwright test tests/app-flow.spec.ts tests/native-preview.spec.ts --project=chromium",
    );

    expect(install).toBeGreaterThan(-1);
    expect(functional).toBeGreaterThan(install);
    expect(workflow).toContain("uses: actions/upload-artifact@v4");
    expect(workflow).toContain("if: failure()");
    expect(workflow).toMatch(/path:\s+test-results/);
  });

  it("requires exact Windows screenshot baselines without a pixel-difference allowance", () => {
    const visual = read("tests/visual.spec.ts");

    expect(visual).not.toContain("maxDiffPixels");
    expect(read("playwright.config.ts")).not.toContain("maxDiffPixels");
  });

  it("runs the complete source and package gates on Windows", () => {
    const workflow = read(".github/workflows/ci.yml");
    const windowsJob = workflow.slice(workflow.indexOf("windows-visual:"));
    const typecheck = windowsJob.indexOf("npm run typecheck");
    const unit = windowsJob.indexOf("npm run test:unit");
    const build = windowsJob.indexOf("npm run build");
    const packageTest = windowsJob.indexOf("npm run test:package");
    const browser = windowsJob.indexOf("npx playwright install chromium");

    expect(typecheck).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(typecheck);
    expect(unit).toBeGreaterThan(build);
    expect(packageTest).toBeGreaterThan(unit);
    expect(browser).toBeGreaterThan(packageTest);
  });

  it("keeps an 80 percent coverage gate in CI", () => {
    const workflow = read(".github/workflows/ci.yml");
    const config = read("vite.config.ts");

    expect(workflow).toContain("npm run test:coverage");
    expect(config).toMatch(/thresholds:\s*\{[\s\S]*branches:\s*80/);
    expect(config).toMatch(/functions:\s*80/);
    expect(config).toMatch(/lines:\s*80/);
    expect(config).toMatch(/statements:\s*80/);
  });
});
