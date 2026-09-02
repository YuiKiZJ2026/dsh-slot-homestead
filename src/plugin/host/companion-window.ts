import { COMPANION_WINDOW_PATH } from "./http";

export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type DockEdge = "left" | "right" | "top" | "bottom";

export function nearestDockEdge(
  bounds: Rectangle,
  workArea: Rectangle,
  threshold = 18,
): DockEdge | null {
  const distances: readonly [DockEdge, number][] = [
    ["left", Math.abs(bounds.x - workArea.x)],
    ["right", Math.abs(workArea.x + workArea.width - (bounds.x + bounds.width))],
    ["top", Math.abs(bounds.y - workArea.y)],
    ["bottom", Math.abs(workArea.y + workArea.height - (bounds.y + bounds.height))],
  ];
  const nearest = distances.reduce((best, candidate) => candidate[1] < best[1] ? candidate : best);
  return nearest[1] <= threshold ? nearest[0] : null;
}

export function collapsedBounds(
  edge: DockEdge,
  bounds: Rectangle,
  workArea: Rectangle,
  revealPixels = 28,
): Rectangle {
  const tabLength = 48;
  switch (edge) {
    case "left": {
      const height = Math.min(tabLength, workArea.height);
      return {
        x: workArea.x,
        y: centeredCoordinate(bounds.y, bounds.height, workArea.y, workArea.height, height),
        width: Math.min(revealPixels, workArea.width),
        height,
      };
    }
    case "right": {
      const width = Math.min(revealPixels, workArea.width);
      const height = Math.min(tabLength, workArea.height);
      return {
        x: workArea.x + workArea.width - width,
        y: centeredCoordinate(bounds.y, bounds.height, workArea.y, workArea.height, height),
        width,
        height,
      };
    }
    case "top": {
      const width = Math.min(tabLength, workArea.width);
      return {
        x: centeredCoordinate(bounds.x, bounds.width, workArea.x, workArea.width, width),
        y: workArea.y,
        width,
        height: Math.min(revealPixels, workArea.height),
      };
    }
    case "bottom": {
      const width = Math.min(tabLength, workArea.width);
      const height = Math.min(revealPixels, workArea.height);
      return {
        x: centeredCoordinate(bounds.x, bounds.width, workArea.x, workArea.width, width),
        y: workArea.y + workArea.height - height,
        width,
        height,
      };
    }
  }
}

export interface BrowserWindowLike {
  blur(): void;
  destroy(): void;
  getBounds(): Rectangle;
  isDestroyed(): boolean;
  loadURL(url: string): Promise<void>;
  on(event: "move" | "resize" | "focus" | "closed", listener: () => void): unknown;
  once(event: "ready-to-show", listener: () => void): unknown;
  setAlwaysOnTop(flag: boolean, level?: string): void;
  setBounds(bounds: Rectangle, animate?: boolean): void;
  setMenuBarVisibility(visible: boolean): void;
  show(): void;
  readonly webContents: {
    on(event: "did-navigate-in-page", listener: (_event: unknown, url: string) => void): unknown;
  };
}

export interface ElectronLike {
  readonly BrowserWindow: {
    new (options: Record<string, unknown>): BrowserWindowLike;
    getAllWindows?(): readonly {
      readonly webContents: { getURL(): string; readonly session?: unknown };
    }[];
  };
  readonly app: {
    isReady(): boolean;
    whenReady(): Promise<void>;
  };
  readonly screen: {
    getDisplayMatching(bounds: Rectangle): { workArea: Rectangle };
    getPrimaryDisplay(): { workArea: Rectangle };
  };
}

export interface CompanionWindowHandle {
  readonly window: BrowserWindowLike;
  dispose(): void;
}

export interface CompanionWindowOptions {
  readonly apiBase: string;
  readonly pageUrl?: string;
  readonly initialScale?: number;
  readonly electronLoader?: () => Promise<ElectronLike>;
  readonly moveDebounceMs?: number;
}

const WINDOW_WIDTH = 560;
const COMPACT_WINDOW_HEIGHT = 330;
const PANEL_WINDOW_HEIGHT = 414;
const MIN_WINDOW_SCALE = 0.75;
const MAX_WINDOW_SCALE = 1.6;

export async function createCompanionWindow(
  options: CompanionWindowOptions,
): Promise<CompanionWindowHandle | null> {
  if (options.electronLoader === undefined && !isElectronRuntime()) return null;
  const electron = await (options.electronLoader ?? loadElectron)();
  if (!electron.app.isReady()) await electron.app.whenReady();
  const workArea = electron.screen.getPrimaryDisplay().workArea;
  const hostSession = findHostSession(electron, options.apiBase);
  let currentScale = clampScale(options.initialScale ?? 1);
  const initialWidth = Math.round(WINDOW_WIDTH * currentScale);
  const initialHeight = Math.round(COMPACT_WINDOW_HEIGHT * currentScale);
  const initialBounds = {
    width: initialWidth,
    height: initialHeight,
    x: workArea.x + workArea.width - initialWidth - 24,
    y: workArea.y + workArea.height - initialHeight - 24,
  };
  const window = new electron.BrowserWindow({
    ...initialBounds,
    transparent: true,
    frame: false,
    resizable: true,
    thickFrame: true,
    movable: true,
    focusable: true,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      ...(hostSession === undefined ? {} : { session: hostSession }),
    },
  });
  window.setMenuBarVisibility(false);
  window.setAlwaysOnTop(true, "floating");
  const nativeBaseWidth = window.getBounds().width / currentScale;

  let disposed = false;
  let programmaticMove = false;
  let expandedBounds: Rectangle | null = null;
  let dockedEdge: DockEdge | null = null;
  let moveTimer: ReturnType<typeof setTimeout> | null = null;
  let programmaticTimer: ReturnType<typeof setTimeout> | null = null;

  const setProgrammaticBounds = (bounds: Rectangle): void => {
    programmaticMove = true;
    window.setBounds(bounds, false);
    if (programmaticTimer !== null) clearTimeout(programmaticTimer);
    programmaticTimer = setTimeout(() => { programmaticMove = false; }, 120);
  };
  const settleAtEdge = (): void => {
    if (disposed || programmaticMove || window.isDestroyed()) return;
    const bounds = window.getBounds();
    const matchingWorkArea = electron.screen.getDisplayMatching(bounds).workArea;
    const edge = nearestDockEdge(bounds, matchingWorkArea);
    if (edge === null) return;
    expandedBounds = snappedExpandedBounds(edge, bounds, matchingWorkArea);
    dockedEdge = edge;
    setProgrammaticBounds(collapsedBounds(edge, expandedBounds, matchingWorkArea));
    window.blur();
  };
  window.on("move", () => {
    if (disposed || programmaticMove) return;
    if (moveTimer !== null) clearTimeout(moveTimer);
    moveTimer = setTimeout(settleAtEdge, options.moveDebounceMs ?? 420);
  });
  window.on("resize", () => {
    if (disposed || window.isDestroyed()) return;
    currentScale = clampScale(window.getBounds().width / nativeBaseWidth);
  });
  window.on("focus", () => {
    if (dockedEdge === null || expandedBounds === null || disposed) return;
    dockedEdge = null;
    setProgrammaticBounds(expandedBounds);
    expandedBounds = null;
  });
  window.on("closed", () => { disposed = true; });
  window.once("ready-to-show", () => { if (!disposed) window.show(); });
  window.webContents.on("did-navigate-in-page", (_event, url) => {
    if (disposed || window.isDestroyed()) return;
    const baseHeight = new URL(url).hash === "#panel" ? PANEL_WINDOW_HEIGHT : COMPACT_WINDOW_HEIGHT;
    const height = Math.round(baseHeight * currentScale);
    if (dockedEdge !== null && expandedBounds !== null) {
      const matchingWorkArea = electron.screen.getDisplayMatching(expandedBounds).workArea;
      const bottom = Math.min(
        expandedBounds.y + expandedBounds.height,
        matchingWorkArea.y + matchingWorkArea.height,
      );
      expandedBounds = {
        ...expandedBounds,
        height,
        y: Math.max(matchingWorkArea.y, bottom - height),
      };
      return;
    }
    const bounds = window.getBounds();
    if (bounds.height === height) return;
    const matchingWorkArea = electron.screen.getDisplayMatching(bounds).workArea;
    const bottom = Math.min(bounds.y + bounds.height, matchingWorkArea.y + matchingWorkArea.height);
    setProgrammaticBounds({
      ...bounds,
      height,
      y: Math.max(matchingWorkArea.y, bottom - height),
    });
  });

  const companionUrl = options.pageUrl === undefined
    ? new URL(COMPANION_WINDOW_PATH, options.apiBase)
    : new URL(options.pageUrl);
  if (!companionUrl.searchParams.has("apiBase")) {
    companionUrl.searchParams.set("apiBase", options.apiBase);
  }
  await window.loadURL(companionUrl.toString());

  return {
    window,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (moveTimer !== null) clearTimeout(moveTimer);
      if (programmaticTimer !== null) clearTimeout(programmaticTimer);
      if (!window.isDestroyed()) window.destroy();
    },
  };
}

function findHostSession(electron: ElectronLike, apiBase: string): unknown | undefined {
  const windows = electron.BrowserWindow.getAllWindows?.() ?? [];
  const apiOrigin = new URL(apiBase).origin;
  for (const candidate of windows) {
    try {
      if (new URL(candidate.webContents.getURL()).origin === apiOrigin) {
        return candidate.webContents.session;
      }
    } catch {
      // Ignore windows that have not navigated to a URL yet.
    }
  }
  return undefined;
}

function centeredCoordinate(
  itemStart: number,
  itemLength: number,
  areaStart: number,
  areaLength: number,
  collapsedLength: number,
): number {
  const centered = Math.round(itemStart + itemLength / 2 - collapsedLength / 2);
  return Math.max(areaStart, Math.min(centered, areaStart + areaLength - collapsedLength));
}

function snappedExpandedBounds(edge: DockEdge, bounds: Rectangle, workArea: Rectangle): Rectangle {
  switch (edge) {
    case "left": return { ...bounds, x: workArea.x };
    case "right": return { ...bounds, x: workArea.x + workArea.width - bounds.width };
    case "top": return { ...bounds, y: workArea.y };
    case "bottom": return { ...bounds, y: workArea.y + workArea.height - bounds.height };
  }
}

function isElectronRuntime(): boolean {
  const runtime = globalThis as typeof globalThis & {
    process?: { versions?: { electron?: string } };
  };
  return typeof runtime.process?.versions?.electron === "string";
}

async function loadElectron(): Promise<ElectronLike> {
  const electronModuleId = "electron";
  return await import(/* @vite-ignore */ electronModuleId) as unknown as ElectronLike;
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_WINDOW_SCALE, Math.max(MIN_WINDOW_SCALE, value));
}
