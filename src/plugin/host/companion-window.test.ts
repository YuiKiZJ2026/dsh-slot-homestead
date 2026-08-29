import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collapsedBounds,
  createCompanionWindow,
  nearestDockEdge,
  type ElectronLike,
} from "./companion-window";

const workArea = { x: 0, y: 0, width: 1920, height: 1040 };

describe("companion window docking", () => {
  it("returns no window outside Electron when no runtime loader is supplied", async () => {
    await expect(createCompanionWindow({ apiBase: "http://127.0.0.1:43120" })).resolves.toBeNull();
  });

  it("detects all four desktop work-area edges", () => {
    expect(nearestDockEdge({ x: 7, y: 300, width: 336, height: 390 }, workArea, 18)).toBe("left");
    expect(nearestDockEdge({ x: 1577, y: 300, width: 336, height: 390 }, workArea, 18)).toBe("right");
    expect(nearestDockEdge({ x: 500, y: 8, width: 336, height: 390 }, workArea, 18)).toBe("top");
    expect(nearestDockEdge({ x: 500, y: 643, width: 336, height: 390 }, workArea, 18)).toBe("bottom");
  });

  it("collapses into a dedicated edge tab so no widget text remains on screen", () => {
    expect(collapsedBounds("left", { x: 0, y: 300, width: 336, height: 390 }, workArea, 28)).toEqual({
      x: 0,
      y: 471,
      width: 28,
      height: 48,
    });
    expect(collapsedBounds("right", { x: 1584, y: 300, width: 336, height: 390 }, workArea, 28)).toEqual({
      x: 1892,
      y: 471,
      width: 28,
      height: 48,
    });
    expect(collapsedBounds("top", { x: 500, y: 0, width: 336, height: 390 }, workArea, 28)).toEqual({
      x: 644,
      y: 0,
      width: 48,
      height: 28,
    });
    expect(collapsedBounds("bottom", { x: 500, y: 650, width: 336, height: 390 }, workArea, 28)).toEqual({
      x: 644,
      y: 1012,
      width: 48,
      height: 28,
    });
  });

  it("creates a sandboxed DSH-owned window, docks it, restores it, and destroys it on disposal", async () => {
    vi.useFakeTimers();
    const fake = new FakeWindow();
    const hostSession = { partition: "dsh-host-session" };
    const handle = await createCompanionWindow({
      apiBase: "http://127.0.0.1:43120",
      pageUrl: "http://127.0.0.1:51234/private-capability/window?apiBase=http%3A%2F%2F127.0.0.1%3A51234%2Fprivate-capability",
      electronLoader: async () => ({
        app: { isReady: () => true, whenReady: async () => undefined },
        BrowserWindow: class {
          static getAllWindows() {
            return [{
              webContents: {
                getURL: () => "http://127.0.0.1:43120/?dsh-desktop-mode=advanced",
                session: hostSession,
              },
            }];
          }
          constructor(options: Record<string, unknown>) {
            fake.options = options;
            return fake;
          }
        },
        screen: {
          getPrimaryDisplay: () => ({ workArea }),
          getDisplayMatching: () => ({ workArea }),
        },
      }) as unknown as ElectronLike,
      moveDebounceMs: 10,
    });

    expect(handle).not.toBeNull();
    expect(fake.options).toMatchObject({
      transparent: true,
      frame: false,
      resizable: true,
      thickFrame: true,
      skipTaskbar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        session: hostSession,
      },
    });
    expect(fake.loadedUrl).toBe(
      "http://127.0.0.1:51234/private-capability/window?apiBase=http%3A%2F%2F127.0.0.1%3A51234%2Fprivate-capability",
    );
    expect(fake.bounds.height).toBe(330);
    fake.emitNavigation("file:///companion/index.html#panel");
    expect(fake.bounds.height).toBe(414);
    fake.emitNavigation("file:///companion/index.html#compact");
    expect(fake.bounds.height).toBe(330);
    await vi.advanceTimersByTimeAsync(120);

    fake.bounds = { x: 4, y: 300, width: 336, height: 330 };
    fake.emit("move");
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.bounds).toEqual({ x: 0, y: 441, width: 28, height: 48 });
    expect(fake.blurred).toBe(true);
    fake.emitNavigation("file:///companion/index.html#panel");
    expect(fake.bounds).toEqual({ x: 0, y: 441, width: 28, height: 48 });
    fake.emit("focus");
    expect(fake.bounds).toEqual({ x: 0, y: 216, width: 336, height: 414 });

    handle?.dispose();
    expect(fake.destroyed).toBe(true);
    fake.emitNavigation("file:///companion/index.html#compact");
    expect(fake.bounds).toEqual({ x: 0, y: 216, width: 336, height: 414 });
    handle?.dispose();
  });

  it("restores the saved scale and keeps panel height proportional", async () => {
    const fake = new FakeWindow();
    const handle = await createCompanionWindow({
      apiBase: "http://127.0.0.1:43120",
      initialScale: 1.25,
      electronLoader: async () => ({
        app: { isReady: () => true, whenReady: async () => undefined },
        BrowserWindow: class {
          constructor(options: Record<string, unknown>) {
            fake.options = options;
            fake.bounds = {
              x: options.x as number,
              y: options.y as number,
              width: options.width as number,
              height: options.height as number,
            };
            return fake;
          }
        },
        screen: {
          getPrimaryDisplay: () => ({ workArea }),
          getDisplayMatching: () => ({ workArea }),
        },
      }) as unknown as ElectronLike,
    });

    expect(fake.bounds.width).toBe(420);
    expect(fake.bounds.height).toBe(413);
    fake.emitNavigation("file:///companion/index.html#panel");
    expect(fake.bounds.width).toBe(420);
    expect(fake.bounds.height).toBe(518);
    handle?.dispose();
  });

  it("calibrates Windows frame rounding without treating it as user scaling", async () => {
    const fake = new FakeWindow();
    fake.bounds = { x: 1555, y: 685, width: 341, height: 331 };
    const handle = await createCompanionWindow({
      apiBase: "http://127.0.0.1:43120",
      electronLoader: async () => ({
        app: { isReady: () => true, whenReady: async () => undefined },
        BrowserWindow: class {
          constructor(options: Record<string, unknown>) {
            fake.options = options;
            return fake;
          }
        },
        screen: {
          getPrimaryDisplay: () => ({ workArea }),
          getDisplayMatching: () => ({ workArea }),
        },
      }) as unknown as ElectronLike,
    });

    fake.emit("resize");
    fake.emitNavigation("file:///companion/index.html#panel");
    expect(fake.bounds.width).toBe(341);
    expect(fake.bounds.height).toBe(414);
    handle?.dispose();
  });

  it("waits for Electron readiness, debounces movement, and ignores positions away from an edge", async () => {
    vi.useFakeTimers();
    const fake = new FakeWindow();
    const whenReady = vi.fn(async () => undefined);
    const handle = await createCompanionWindow({
      apiBase: "http://127.0.0.1:43120",
      electronLoader: async () => ({
        app: { isReady: () => false, whenReady },
        BrowserWindow: class {
          constructor(options: Record<string, unknown>) {
            fake.options = options;
            return fake;
          }
        },
        screen: {
          getPrimaryDisplay: () => ({ workArea }),
          getDisplayMatching: () => ({ workArea }),
        },
      }) as unknown as ElectronLike,
      moveDebounceMs: 10,
    });

    expect(whenReady).toHaveBeenCalledOnce();
    fake.emit("focus");
    fake.emitNavigation("file:///companion/index.html#compact");
    expect(fake.bounds.height).toBe(330);
    fake.bounds = { x: 500, y: 300, width: 336, height: 330 };
    fake.emit("move");
    fake.emit("move");
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.bounds).toEqual({ x: 500, y: 300, width: 336, height: 330 });
    expect(fake.blurred).toBe(false);
    fake.emit("ready-to-show");
    expect(fake.shown).toBe(true);
    handle?.dispose();
    fake.shown = false;
    fake.emit("ready-to-show");
    fake.emit("move");
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.shown).toBe(false);
  });

  it("uses the default dock delay and leaves an already destroyed window alone", async () => {
    vi.useFakeTimers();
    const fake = new FakeWindow();
    const handle = await createCompanionWindow({
      apiBase: "http://127.0.0.1:43120",
      electronLoader: async () => ({
        app: { isReady: () => true, whenReady: async () => undefined },
        BrowserWindow: class {
          constructor(options: Record<string, unknown>) {
            fake.options = options;
            return fake;
          }
        },
        screen: {
          getPrimaryDisplay: () => ({ workArea }),
          getDisplayMatching: () => ({ workArea }),
        },
      }) as unknown as ElectronLike,
    });

    fake.bounds = { x: 3, y: 300, width: 336, height: 330 };
    fake.emit("move");
    await vi.advanceTimersByTimeAsync(419);
    expect(fake.bounds.x).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.bounds).toEqual({ x: 0, y: 441, width: 28, height: 48 });
    fake.destroyed = true;
    handle?.dispose();
    expect(fake.destroyed).toBe(true);
  });

  it.each([
    ["right", { x: 1580, y: 300, width: 336, height: 330 }, { x: 1892, y: 441, width: 28, height: 48 }, { x: 1584, y: 300, width: 336, height: 330 }],
    ["top", { x: 500, y: 4, width: 336, height: 330 }, { x: 644, y: 0, width: 48, height: 28 }, { x: 500, y: 0, width: 336, height: 330 }],
    ["bottom", { x: 500, y: 706, width: 336, height: 330 }, { x: 644, y: 1012, width: 48, height: 28 }, { x: 500, y: 710, width: 336, height: 330 }],
  ] as const)("docks and restores the %s edge", async (_edge, start, collapsed, restored) => {
    vi.useFakeTimers();
    const fake = new FakeWindow();
    const handle = await createCompanionWindow({
      apiBase: "http://127.0.0.1:43120",
      electronLoader: async () => ({
        app: { isReady: () => true, whenReady: async () => undefined },
        BrowserWindow: class {
          constructor(options: Record<string, unknown>) {
            fake.options = options;
            return fake;
          }
        },
        screen: {
          getPrimaryDisplay: () => ({ workArea }),
          getDisplayMatching: () => ({ workArea }),
        },
      }) as unknown as ElectronLike,
      moveDebounceMs: 10,
    });

    fake.bounds = { ...start };
    fake.emit("move");
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.bounds).toEqual(collapsed);
    fake.emit("focus");
    expect(fake.bounds).toEqual(restored);
    handle?.dispose();
  });
});

afterEach(() => vi.useRealTimers());

class FakeWindow {
  options: Record<string, unknown> = {};
  bounds = { x: 1560, y: 686, width: 336, height: 330 };
  loadedUrl = "";
  destroyed = false;
  blurred = false;
  shown = false;
  private readonly listeners = new Map<string, Array<() => void>>();
  private navigationListener: ((_event: unknown, url: string) => void) | null = null;
  readonly webContents = {
    on: (_event: "did-navigate-in-page", listener: (_event: unknown, url: string) => void) => {
      this.navigationListener = listener;
    },
  };

  blur(): void { this.blurred = true; }
  destroy(): void { this.destroyed = true; }
  getBounds() { return this.bounds; }
  isDestroyed(): boolean { return this.destroyed; }
  async loadURL(url: string): Promise<void> { this.loadedUrl = url; }
  on(event: string, listener: () => void): void {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], listener]);
  }
  once(event: string, listener: () => void): void { this.on(event, listener); }
  setAlwaysOnTop(): void {}
  setBounds(bounds: typeof this.bounds): void { this.bounds = { ...bounds }; }
  setMenuBarVisibility(): void {}
  show(): void { this.shown = true; }
  emit(event: string): void { for (const listener of this.listeners.get(event) ?? []) listener(); }
  emitNavigation(url: string): void { this.navigationListener?.(undefined, url); }
}
