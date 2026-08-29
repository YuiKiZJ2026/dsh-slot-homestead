import { useEffect, useState } from "react";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import collectiblesUrl from "./assets/collectibles.png";
import reelsUrl from "./assets/reel-symbols-runtime.png";
import sceneUrl from "./assets/scene-base.png";
import type { SceneAssetUrls } from "../../game/renderer/assets";
import { HttpGameApi } from "./api";
import { PluginApp } from "./PluginApp";
import { installPluginStyle } from "./style";

const ASSET_URLS: SceneAssetUrls = {
  scene: sceneUrl,
  reels: reelsUrl,
  collectibles: collectiblesUrl,
};

export const inject = ["slots"];
export const GLOBAL_GAME_SCOPE_ID = "dsh-slot-widget-global";

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "dsh-slot-widget",
    order: 20,
  }, SlotWidgetOverlay));
}

export function SlotWidgetOverlay() {
  const [api] = useState(() => new HttpGameApi());
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async (): Promise<void> => {
      try {
        const response = await fetch("/api/dsh-slot-widget/companion", { method: "GET" });
        const body = await response.json() as { status?: unknown };
        if (!active) return;
        if (body.status === "active") return;
        if (body.status === "unavailable") {
          setFallback(true);
          return;
        }
      } catch {
        if (active) setFallback(true);
        return;
      }
      timer = setTimeout(() => { void check(); }, 300);
    };
    void check();
    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
  useEffect(() => fallback ? installPluginStyle(document) : undefined, [fallback]);
  if (!fallback) return null;
  return (
    <PluginApp
      api={api}
      sessionId={GLOBAL_GAME_SCOPE_ID}
      assetUrls={ASSET_URLS}
      displayMode="overlay"
    />
  );
}
