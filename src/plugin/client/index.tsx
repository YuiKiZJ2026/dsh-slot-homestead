import { useEffect, useState } from "react";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type { ConvViewProps } from "@deepseek-ai/dsh-client-ui-conversation/client";
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

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "dsh-slot-widget",
    label: "老虎机",
    order: 20,
  }, SlotWidgetView));
}

export function SlotWidgetView({ sessionId }: ConvViewProps) {
  const [api] = useState(() => new HttpGameApi());
  useEffect(() => installPluginStyle(document), []);
  return <PluginApp api={api} sessionId={sessionId} assetUrls={ASSET_URLS} />;
}
