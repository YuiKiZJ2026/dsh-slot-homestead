// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available in Vitest; browser-facing typecheck omits @types/node.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error Node globals are available in Vitest; browser-facing typecheck omits @types/node.
const root = process.cwd();

describe("marketplace screenshot gallery", () => {
  it("publishes one ordered gallery of current, repository-hosted captures", () => {
    const screenshots = JSON.parse(
      readFileSync(resolve(root, "screenshots.json"), "utf8"),
    ) as string[];

    expect(screenshots).toEqual([
      "docs/demo-preview.png",
      "docs/screenshots/02-garden-day.png",
      "docs/screenshots/03-pasture-night.png",
      "docs/screenshots/04-slot-result.png",
    ]);
    expect(screenshots.length).toBeGreaterThanOrEqual(1);
    expect(screenshots.length).toBeLessThanOrEqual(8);
    for (const screenshot of screenshots) {
      expect(screenshot).toMatch(/^docs\/[a-z0-9/-]+\.png$/);
      expect(existsSync(resolve(root, screenshot)), screenshot).toBe(true);
    }
  });
});
