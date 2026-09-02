import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Shanghai" });

const CASES = [
  {
    phase: "dawn",
    label: "清晨微光",
    time: "2026-08-31T05:30:00+08:00",
    filter: "brightness(0.88) saturate(0.94) sepia(0.09) contrast(1.04)",
  },
  {
    phase: "day",
    label: "日间明亮",
    time: "2026-08-31T09:30:00+08:00",
    filter: "brightness(1.06) saturate(1.04) contrast(1.02)",
  },
  {
    phase: "dusk",
    label: "傍晚暖光",
    time: "2026-08-31T18:30:00+08:00",
    filter: "brightness(0.74) saturate(0.96) sepia(0.18) contrast(1.08)",
  },
  {
    phase: "night",
    label: "夜间熄灯",
    time: "2026-08-31T22:30:00+08:00",
    filter: "brightness(0.52) saturate(0.7) contrast(1.14)",
  },
] as const;

for (const expected of CASES) {
  test(`${expected.phase} follows the computer clock without covering the transparent canvas`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(expected.time));
    await page.goto("/");

    const application = page.getByRole("application", { name: "DSH 桌面老虎机" });
    await expect(application).toHaveAttribute("data-day-phase", expected.phase);
    await expect(page.getByRole("status", { name: `当前系统光照：${expected.label}` }))
      .toBeVisible();
    await expect(page.locator("canvas[data-render-state]"))
      .toHaveAttribute("data-render-state", "ready");

    const appearance = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".desktop");
      const ambient = document.querySelector<HTMLElement>(".desktop__ambient");
      const art = document.querySelector<HTMLElement>(".ecosystem-scene__art");
      const slot = document.querySelector<HTMLElement>(".slot-widget");
      const canvas = document.querySelector<HTMLCanvasElement>(".slot-widget canvas");
      if (root === null || ambient === null || art === null || slot === null || canvas === null) {
        throw new Error("daylight surfaces are missing");
      }
      return {
        variable: getComputedStyle(root).getPropertyValue("--daylight-scene-filter").trim(),
        ambientOpacity: Number(getComputedStyle(ambient).opacity),
        artFilter: getComputedStyle(art).filter,
        canvasFilter: getComputedStyle(canvas).filter,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        slotBackground: getComputedStyle(slot).backgroundColor,
        slotBeforeContent: getComputedStyle(slot, "::before").content,
      };
    });

    expect(appearance.variable).toBe(expected.filter);
    expect(appearance.artFilter).not.toBe("none");
    if (expected.phase === "night") {
      expect(appearance.canvasFilter).toBe(
        "brightness(0.82) saturate(0.9) sepia(0.08) contrast(1.08)",
      );
      expect(filterFunctionNumber(appearance.canvasFilter, "brightness"))
        .toBeGreaterThan(filterFunctionNumber(appearance.artFilter, "brightness"));
    } else {
      expect(appearance.canvasFilter).toBe(appearance.artFilter);
    }
    expect(appearance.ambientOpacity).toBeGreaterThan(0);
    expect(appearance.canvasBackground).toBe("rgba(0, 0, 0, 0)");
    expect(appearance.slotBackground).toBe("rgba(0, 0, 0, 0)");
    expect(appearance.slotBeforeContent).toBe("none");

    const nextHabitat = page.getByRole("button", { name: "下一处养成场景" });
    await expect(nextHabitat).toBeEnabled();
    await nextHabitat.click();
    await expect(page.getByRole("region", { name: "养成生态", exact: true }))
      .toContainText("种植园 2 / 3");
  });
}

for (const previewPath of ["/", "/native-preview.html"] as const) {
  test(`night atmosphere decorates every habitat without blocking controls on ${previewPath}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.setFixedTime(new Date("2026-08-31T22:30:00+08:00"));
    await page.goto(previewPath);

    const sky = page.locator('[data-night-sky="moon-stars"]');
    await expect(sky).toHaveCount(1);
    await expect(sky).toHaveAttribute("aria-hidden", "true");
    await expect(sky).toHaveAttribute("data-night-anchor", "workbench");
    const skyAppearance = await sky.evaluate((element) => ({
      opacity: Number(getComputedStyle(element).opacity),
      pointerEvents: getComputedStyle(element).pointerEvents,
    }));
    const skyBox = await sky.boundingBox();
    expect(skyAppearance.opacity).toBeGreaterThan(0.5);
    expect(skyAppearance.pointerEvents).toBe("none");
    expect(skyBox).not.toBeNull();
    expect(skyBox!.width).toBeLessThan(420);

    const moon = sky.locator(".desktop__pixel-moon");
    const workbench = page.getByRole("region", { name: "老虎机与养成生态" });
    const commandDeck = page.locator(".ecosystem-scene__command-deck");
    const moonBox = await moon.boundingBox();
    const workbenchBox = await workbench.boundingBox();
    const commandDeckBox = await commandDeck.boundingBox();
    expect(moonBox).not.toBeNull();
    expect(workbenchBox).not.toBeNull();
    expect(commandDeckBox).not.toBeNull();
    await expect(moon).toHaveAttribute("data-moon-art", "hand-drawn-pixels");
    await expect(moon).toHaveAttribute("data-moon-phase", "crescent");
    await expect(moon).toHaveAttribute("data-moon-style", "rounded-crescent");
    await expect(moon).toHaveAttribute("data-moon-arc", "offset-circles");
    await expect(moon).toHaveAttribute("viewBox", "0 0 217 217");
    const moonPixels = await moon.locator("rect[data-moon-pixel]").evaluateAll((pixels) => (
      pixels.map((pixel) => ({
        x: Number(pixel.getAttribute("x")),
        y: Number(pixel.getAttribute("y")),
        width: Number(pixel.getAttribute("width")),
        height: Number(pixel.getAttribute("height")),
      }))
    ));
    expect(moonPixels.length).toBeGreaterThanOrEqual(90);
    moonPixels.forEach((pixel) => {
      expect(pixel.x).toBeGreaterThanOrEqual(0);
      expect(pixel.y).toBeGreaterThanOrEqual(0);
      expect(pixel.x % 7).toBe(0);
      expect(pixel.y % 7).toBe(0);
      expect(pixel.width).toBeGreaterThan(0);
      expect(pixel.width % 7).toBe(0);
      expect(pixel.height).toBe(7);
      expect(pixel.x + pixel.width).toBeLessThanOrEqual(217);
      expect(pixel.y + pixel.height).toBeLessThanOrEqual(217);
    });
    expectRoundedCrescentGeometry(moonPixels);
    const moonAppearance = await moon.evaluate((element) => ({
      clipPath: getComputedStyle(element).clipPath,
      width: Number.parseFloat(getComputedStyle(element).width),
      height: Number.parseFloat(getComputedStyle(element).height),
    }));
    expect(moonAppearance.clipPath).toBe("none");
    expect(moonAppearance.width).toBe(63);
    expect(moonAppearance.height).toBe(63);
    const moonDistanceFromWorkbench = Math.hypot(
      Math.max(0, workbenchBox!.x - (moonBox!.x + moonBox!.width), moonBox!.x - (workbenchBox!.x + workbenchBox!.width)),
      Math.max(0, workbenchBox!.y - (moonBox!.y + moonBox!.height), moonBox!.y - (workbenchBox!.y + workbenchBox!.height)),
    );
    expect(moonDistanceFromWorkbench).toBeLessThan(260);
    expect(moonBox!.x + moonBox!.width / 2)
      .toBeLessThan(workbenchBox!.x + workbenchBox!.width * 0.55);
    expect(moonBox!.y + moonBox!.height / 2)
      .toBeLessThan(workbenchBox!.y + workbenchBox!.height * 0.35);
    const moonCommandOverlap = Math.max(
      0,
      Math.min(moonBox!.x + moonBox!.width, commandDeckBox!.x + commandDeckBox!.width)
        - Math.max(moonBox!.x, commandDeckBox!.x),
    ) * Math.max(
      0,
      Math.min(moonBox!.y + moonBox!.height, commandDeckBox!.y + commandDeckBox!.height)
        - Math.max(moonBox!.y, commandDeckBox!.y),
    );
    expect(moonCommandOverlap).toBe(0);

    const moonlight = page.locator('[data-night-moonlight="workbench"]');
    await expect(moonlight).toHaveAttribute("aria-hidden", "true");
    const moonlightAppearance = await moonlight.evaluate((element) => ({
      opacity: Number(getComputedStyle(element).opacity),
      pointerEvents: getComputedStyle(element).pointerEvents,
      clipPath: getComputedStyle(element).clipPath,
    }));
    expect(moonlightAppearance.opacity).toBeGreaterThan(0.35);
    expect(moonlightAppearance.pointerEvents).toBe("none");
    expect(moonlightAppearance.clipPath).toBe("none");

    const slotBox = await page.locator(".slot-widget").boundingBox();
    expect(slotBox).not.toBeNull();
    const nightSurfaceFilters = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(".slot-widget canvas");
      const habitat = document.querySelector<HTMLElement>(".ecosystem-scene__art");
      if (canvas === null || habitat === null) throw new Error("night surfaces are missing");
      return {
        slot: getComputedStyle(canvas).filter,
        habitat: getComputedStyle(habitat).filter,
      };
    });
    expect(filterFunctionNumber(nightSurfaceFilters.slot, "brightness"))
      .toBeGreaterThanOrEqual(0.64);
    expect(filterFunctionNumber(nightSurfaceFilters.slot, "brightness"))
      .toBeGreaterThan(filterFunctionNumber(nightSurfaceFilters.habitat, "brightness"));
    expect(nightSurfaceFilters.slot).toMatch(/(?:saturate|drop-shadow)\(/i);
    const slotLightCenters: string[] = [];
    const minimumSlotOpacity = {
      cabinet: 0.88,
      marquee: 0.5,
      reels: 0.88,
      "control-panel": 0.88,
    } as const;
    for (const light of ["cabinet", "marquee", "reels", "control-panel"] as const) {
      const slotLight = page.locator(`[data-slot-night-light="${light}"]`);
      await expect(slotLight).toHaveAttribute("aria-hidden", "true");
      const appearance = await slotLight.evaluate((element) => ({
        opacity: Number(getComputedStyle(element).opacity),
        pointerEvents: getComputedStyle(element).pointerEvents,
        backgroundImage: getComputedStyle(element).backgroundImage,
        borderTopColor: getComputedStyle(element).borderTopColor,
        borderTopWidth: Number.parseFloat(getComputedStyle(element).borderTopWidth),
        boxShadow: getComputedStyle(element).boxShadow,
      }));
      const lightBox = await slotLight.boundingBox();
      expect(lightBox).not.toBeNull();
      expect(appearance.opacity).toBeGreaterThanOrEqual(minimumSlotOpacity[light]);
      expect(appearance.pointerEvents).toBe("none");
      expect(appearance.backgroundImage).not.toBe("none");
      expect(lightBox!.x).toBeGreaterThanOrEqual(slotBox!.x);
      expect(lightBox!.y).toBeGreaterThanOrEqual(slotBox!.y);
      expect(lightBox!.x + lightBox!.width).toBeLessThanOrEqual(slotBox!.x + slotBox!.width);
      expect(lightBox!.y + lightBox!.height).toBeLessThanOrEqual(slotBox!.y + slotBox!.height);
      if (light !== "marquee") {
        expect(appearance.borderTopWidth).toBe(0);
        expect(appearance.boxShadow).toBe("none");
      }
      slotLightCenters.push(`${Math.round(lightBox!.x + lightBox!.width / 2)}:${Math.round(lightBox!.y + lightBox!.height / 2)}`);
    }
    expect(new Set(slotLightCenters).size).toBe(4);

    const assertNightHabitat = async (
      prop: "aquarium-lamp" | "garden-lamp" | "pasture-lamp",
      glow: "aquarium" | "garden" | "animals",
      cast: "tank-wash" | "garden-pool" | "left",
      minimumOpacity: number,
    ) => {
      const fixture = page.locator(`[data-habitat-prop="${prop}"]`);
      const light = page.locator(`[data-night-glow="${glow}"]`);
      const hotspot = page.locator(`[data-night-hotspot="${glow}"]`);
      await expect(fixture).toHaveCount(1);
      await expect(fixture).toHaveAttribute("aria-hidden", "true");
      await expect(light).toHaveCount(1);
      await expect(light).toHaveAttribute("aria-hidden", "true");
      await expect(light).toHaveAttribute("data-light-cast", cast);
      await expect(hotspot).toHaveAttribute("aria-hidden", "true");
      const appearance = await light.evaluate((element) => ({
        opacity: Number(getComputedStyle(element).opacity),
        pointerEvents: getComputedStyle(element).pointerEvents,
        animationName: getComputedStyle(element).animationName,
      }));
      const hotspotAppearance = await hotspot.evaluate((element) => ({
        opacity: Number(getComputedStyle(element).opacity),
        pointerEvents: getComputedStyle(element).pointerEvents,
        animationName: getComputedStyle(element).animationName,
        animationDuration: getComputedStyle(element).animationDuration,
      }));
      const habitatBox = await page.locator(".ecosystem-scene__habitat-bay").boundingBox();
      const hotspotBox = await hotspot.boundingBox();
      expect(appearance.opacity).toBeGreaterThanOrEqual(minimumOpacity);
      expect(appearance.pointerEvents).toBe("none");
      expect(appearance.animationName).toBe("none");
      expect(hotspotAppearance.opacity).toBeGreaterThan(0.35);
      expect(hotspotAppearance.pointerEvents).toBe("none");
      expect(hotspotAppearance.animationName).not.toBe("none");
      expect(Number.parseFloat(hotspotAppearance.animationDuration)).toBeGreaterThanOrEqual(2.5);
      expect(habitatBox).not.toBeNull();
      expect(hotspotBox).not.toBeNull();
      expect(hotspotBox!.width).toBeLessThan(habitatBox!.width * 0.18);
      expect(hotspotBox!.height).toBeLessThan(habitatBox!.height * 0.25);
    };

    await assertNightHabitat("aquarium-lamp", "aquarium", "tank-wash", 0.88);

    const nextHabitat = page.getByRole("button", { name: "下一处养成场景" });
    await expect(nextHabitat).toBeEnabled();
    await nextHabitat.click();
    await assertNightHabitat("garden-lamp", "garden", "garden-pool", 0.88);
    await expect(page.locator('[data-habitat-prop="scarecrow"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await nextHabitat.click();
    await assertNightHabitat("pasture-lamp", "animals", "left", 0.74);
    const pastureWash = await page.locator('[data-night-glow="animals"]').evaluate((element) => ({
      opacity: Number(getComputedStyle(element).opacity),
      backgroundImage: getComputedStyle(element).backgroundImage,
    }));
    expect(pastureWash.opacity).toBeCloseTo(0.74);
    expect(pastureWash.backgroundImage).toContain("rgba(244, 168, 65, 0.3)");
    expect(pastureWash.backgroundImage).toContain("rgba(210, 118, 31, 0.14)");
    await expect(page.locator('[data-habitat-prop="pasture-lamp"]'))
      .toHaveAttribute("data-lamp-facing", "left");
    await expect(page.locator('.ecosystem-scene__habitat-stage[data-habitat="animals"] [data-resident-id]'))
      .toHaveCount(0);
    const restLayer = page.locator('[data-night-rest="animals"]');
    await expect(restLayer).toHaveAttribute("data-routine-state", "resting");
    const restAppearance = await restLayer.evaluate((element) => ({
      opacity: Number(getComputedStyle(element).opacity),
      pointerEvents: getComputedStyle(element).pointerEvents,
    }));
    expect(restAppearance.opacity).toBeGreaterThan(0.35);
    expect(restAppearance.pointerEvents).toBe("none");

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.locator('[data-night-glow="animals"]').evaluate(
      (element) => getComputedStyle(element).animationName,
    )).toBe("none");
    expect(await page.locator('[data-night-hotspot="animals"]').evaluate(
      (element) => getComputedStyle(element).animationName,
    )).toBe("none");
  });

  test(`day hides the sky and lamp glow but keeps physical garden props on ${previewPath}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-08-31T09:30:00+08:00"));
    await page.goto(previewPath);

    const sky = page.locator('[data-night-sky="moon-stars"]');
    await expect(sky).toHaveCount(1);
    expect(await sky.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(0);
    expect(await page.locator('[data-night-moonlight="workbench"]').evaluate(
      (element) => Number(getComputedStyle(element).opacity),
    )).toBe(0);
    for (const light of ["cabinet", "marquee", "reels", "control-panel"] as const) {
      const slotLight = page.locator(`[data-slot-night-light="${light}"]`);
      await expect(slotLight).toHaveCount(1);
      expect(await slotLight.evaluate(
        (element) => Number(getComputedStyle(element).opacity),
      )).toBe(0);
    }

    await page.getByRole("button", { name: "下一处养成场景" }).click();
    await expect(page.locator('[data-habitat-prop="garden-lamp"]')).toHaveCount(1);
    await expect(page.locator('[data-habitat-prop="scarecrow"]')).toHaveCount(1);
    expect(await page.locator('[data-night-glow="garden"]').evaluate(
      (element) => Number(getComputedStyle(element).opacity),
    )).toBe(0);

    await page.getByRole("button", { name: "打开种植园养成抽屉" }).click();
    const careButton = page.getByRole("button", { name: "施肥种植园" });
    await expect(careButton).toBeEnabled();
    await careButton.click();

    await page.getByRole("button", { name: "下一处养成场景" }).click();
    await expect(page.locator('.ecosystem-scene__habitat-stage[data-habitat="animals"] [data-resident-id="chick"]'))
      .toHaveAttribute("data-routine-state", "active");
    await expect(page.locator('[data-night-rest="animals"]')).toHaveCount(0);
    await page.getByRole("button", { name: "与小鸡互动" }).click();
    await expect(page.getByText("小鸡开心地跑来啄了啄")).toBeVisible();
  });
}

function filterFunctionNumber(filter: string, functionName: string): number {
  const match = filter.match(new RegExp(`${functionName}\\(\\s*([.\\d]+)`, "i"));
  if (match === null) throw new Error(`Missing ${functionName}() in ${filter}`);
  return Number(match[1]);
}

type MoonPixelRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

function occupiedMoonCells(pixels: readonly MoonPixelRect[]): Set<string> {
  const occupied = new Set<string>();
  pixels.forEach((pixel) => {
    const x = pixel.x / 7;
    const y = pixel.y / 7;
    const width = pixel.width / 7;
    const height = pixel.height / 7;
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        occupied.add(`${column}:${row}`);
      }
    }
  });
  return occupied;
}

function expectRoundedCrescentGeometry(pixels: readonly MoonPixelRect[]): void {
  const occupied = occupiedMoonCells(pixels);
  expect(occupied.size).toBeGreaterThanOrEqual(220);
  expect(occupied.size).toBeLessThanOrEqual(420);

  const columnsByRow = new Map<number, number[]>();
  occupied.forEach((cell) => {
    const [column, row] = cell.split(":").map(Number);
    const columns = columnsByRow.get(row) ?? [];
    columns.push(column);
    columnsByRow.set(row, columns);
  });
  columnsByRow.forEach((columns) => columns.sort((a, b) => a - b));

  const usedRows = [...columnsByRow.keys()].sort((a, b) => a - b);
  expect(usedRows.length).toBeGreaterThanOrEqual(29);
  expect(usedRows[0]).toBeLessThanOrEqual(1);
  expect(usedRows.at(-1)).toBeGreaterThanOrEqual(29);
  expect(usedRows.at(-1)! - usedRows[0] + 1).toBe(usedRows.length);

  const leftEdges = new Map<number, number>();
  const rightEdges = new Map<number, number>();
  usedRows.forEach((row) => {
    const columns = columnsByRow.get(row)!;
    const left = columns[0];
    const right = columns.at(-1)!;
    expect(right - left + 1).toBe(columns.length);
    leftEdges.set(row, left);
    rightEdges.set(row, right);
  });

  const centerY = (usedRows[0] + usedRows.at(-1)!) / 2;
  expect(Math.abs(centerY - 15)).toBeLessThanOrEqual(0.5);
  const outerRadius = usedRows.length / 2;
  const outerCircleErrors = usedRows.map((row) => {
    const dy = row - centerY;
    const expectedLeft = Math.ceil(
      15 - Math.sqrt(Math.max(0, outerRadius ** 2 - dy ** 2)),
    );
    return Math.abs(leftEdges.get(row)! - expectedLeft);
  });
  expect(Math.max(...outerCircleErrors)).toBeLessThanOrEqual(2);
  expect(outerCircleErrors.reduce((sum, error) => sum + error, 0) / outerCircleErrors.length)
    .toBeLessThanOrEqual(1);

  for (const row of usedRows) {
    const mirrorRow = Math.round(centerY * 2 - row);
    if (!leftEdges.has(mirrorRow)) continue;
    expect(Math.abs(leftEdges.get(row)! - leftEdges.get(mirrorRow)!))
      .toBeLessThanOrEqual(1);
    expect(Math.abs(rightEdges.get(row)! - rightEdges.get(mirrorRow)!))
      .toBeLessThanOrEqual(1);
  }

  const centerRow = Math.round(centerY);
  const centerArc = Array.from(
    { length: 7 },
    (_, index) => rightEdges.get(centerRow - 3 + index)!,
  );
  expect(Math.max(...centerArc) - Math.min(...centerArc)).toBeLessThanOrEqual(1);
  expect(rightEdges.get(centerRow - 10)! - rightEdges.get(centerRow - 3)!)
    .toBeGreaterThanOrEqual(3);
  expect(rightEdges.get(centerRow + 10)! - rightEdges.get(centerRow + 3)!)
    .toBeGreaterThanOrEqual(3);

  const centerThickness = rightEdges.get(centerRow)! - leftEdges.get(centerRow)! + 1;
  expect(centerThickness).toBeGreaterThanOrEqual(6);
  expect(centerThickness).toBeLessThanOrEqual(11);

  const innerArcFit = bestOffsetCircleFit(rightEdges, centerY);
  expect(innerArcFit.samples).toBeGreaterThanOrEqual(17);
  expect(innerArcFit.centerX).toBeGreaterThan(15.5);
  expect(innerArcFit.rmse).toBeLessThanOrEqual(0.85);
}

function bestOffsetCircleFit(
  rightEdges: ReadonlyMap<number, number>,
  centerY: number,
): { centerX: number; rmse: number; samples: number } {
  let best = { centerX: 0, rmse: Number.POSITIVE_INFINITY, samples: 0 };
  for (let arcCenterX = 18; arcCenterX <= 30; arcCenterX += 0.25) {
    for (let arcCenterY = centerY - 1; arcCenterY <= centerY + 1; arcCenterY += 0.25) {
      for (let radius = 9; radius <= 18; radius += 0.25) {
        let squaredError = 0;
        let samples = 0;
        for (let row = Math.ceil(centerY - 10); row <= Math.floor(centerY + 10); row += 1) {
          const actual = rightEdges.get(row);
          const dy = row - arcCenterY;
          if (actual === undefined || Math.abs(dy) >= radius) continue;
          const expected = Math.ceil(
            arcCenterX - Math.sqrt(radius ** 2 - dy ** 2),
          ) - 1;
          squaredError += (actual - expected) ** 2;
          samples += 1;
        }
        if (samples < 17) continue;
        const rmse = Math.sqrt(squaredError / samples);
        if (rmse < best.rmse) best = { centerX: arcCenterX, rmse, samples };
      }
    }
  }
  return best;
}
