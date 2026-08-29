import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { CollectionPanel } from "../../components/CollectionPanel";
import { GameCanvas } from "../../components/GameCanvas";
import { SettingsPanel, useDoubleScaleAvailability } from "../../components/SettingsPanel";
import { ShopPanel } from "../../components/ShopPanel";
import { hasStarryNightTheme } from "../../inventory/inventory";
import { loadSceneAssets, type SceneAssets, type SceneAssetUrls } from "../../game/renderer/assets";
import type { GameApi } from "./api";
import { TokenEnergyMeter } from "./TokenEnergyMeter";
import { useHostGameController } from "./use-host-game-controller";

type UtilityPanel = "collection" | "shop" | "settings";
const COMPANION_BASE_WIDTH = 336;
const COMPANION_COMPACT_HEIGHT = 330;
const COMPANION_PANEL_HEIGHT = 414;
const MIN_COMPANION_SCALE = 0.75;
const MAX_COMPANION_SCALE = 1.6;

export interface PluginAppProps {
  api: GameApi;
  sessionId: string;
  assetUrls: SceneAssetUrls;
  loadAssets?: () => Promise<SceneAssets>;
  displayMode?: "page" | "overlay" | "companion";
}

export function PluginApp({
  api,
  sessionId,
  assetUrls,
  loadAssets,
  displayMode = "page",
}: PluginAppProps) {
  const controller = useHostGameController({ api, sessionId });
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel | null>(null);
  const [companionViewport, setCompanionViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const doubleScaleAvailable = useDoubleScaleAvailability();
  const companionBaseHeight = utilityPanel === null
    ? COMPANION_COMPACT_HEIGHT
    : COMPANION_PANEL_HEIGHT;
  const companionScale = clampCompanionScale(Math.min(
    companionViewport.width / COMPANION_BASE_WIDTH,
    companionViewport.height / companionBaseHeight,
  ));
  const scale = displayMode === "companion"
    ? utilityPanel === null ? 0.7 : 0.64
    : controller.gameState.settings.scale === 2 && doubleScaleAvailable ? 2 : 1;
  const rootStyle = {
    "--widget-scale": scale,
    "--widget-width": `${384 * scale}px`,
    "--widget-height": `${288 * scale}px`,
    "--companion-scale": companionScale,
    "--companion-base-height": `${companionBaseHeight}px`,
  } as CSSProperties;
  const loadExplicitAssets = useCallback(
    () => loadAssets === undefined ? loadSceneAssets(assetUrls) : loadAssets(),
    [assetUrls, loadAssets],
  );
  const snapshot = controller.snapshot;
  const dailyTokenCoins = snapshot === null
    ? 0
    : snapshot.tokenEnergy.dailyCoins[snapshot.localDate] ?? 0;
  const toggleUtilityPanel = (panel: UtilityPanel): void => {
    setUtilityPanel((current) => current === panel ? null : panel);
  };
  useEffect(() => {
    if (displayMode !== "companion") return;
    const measure = (): void => setCompanionViewport({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [displayMode]);
  useEffect(() => {
    if (displayMode !== "companion" || snapshot === null || controller.mutationsDisabled) return;
    const persisted = snapshot.settings.companionScale ?? 1;
    const measured = companionScale;
    const normalized = normalizeCompanionScale(measured);
    if (Math.abs(persisted - normalized) < 0.01) return;
    const timer = setTimeout(() => {
      void controller.setSettings({ companionScale: normalized });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    companionScale,
    controller.mutationsDisabled,
    controller.setSettings,
    displayMode,
    snapshot,
  ]);
  useEffect(() => {
    if (displayMode !== "companion") return;
    const nextHash = utilityPanel === null ? "#compact" : "#panel";
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }, [displayMode, utilityPanel]);
  const rootClass = [
    "dsh-slot-widget-root",
    "desktop",
    displayMode === "overlay" ? "desktop--overlay" : "desktop--page",
    displayMode === "companion" ? "desktop--companion" : "",
    utilityPanel === null ? "" : "has-utility-panel",
    hasStarryNightTheme(controller.gameState) ? "desktop--starry" : "",
  ].filter(Boolean).join(" ");

  return (
    <main
      className={rootClass}
      style={rootStyle}
      role="application"
      aria-label="DSH 桌面老虎机"
      data-display-mode={displayMode}
    >
      {displayMode === "companion" ? (
        <button type="button" className="edge-reveal-tab" aria-label="展开老虎机">◆</button>
      ) : null}
      <div className={displayMode === "companion" ? "companion-scale-surface" : "plugin-content-surface"}>
      <div className="desktop__ambient" aria-hidden="true" />
      <section className="host-status" role="region" aria-label="Host 游戏状态" aria-live="polite">
        <div className="wallet-status">
          <span>钱包</span>
          <strong data-testid="wallet-count">{snapshot?.wallet ?? 0}</strong>
          <span>枚</span>
        </div>
        <TokenEnergyMeter
          progress={snapshot?.tokenEnergy.progress ?? 0}
          dailyCoins={dailyTokenCoins}
        />
        <p className="reward-source-status">未连接任务奖励来源</p>
        {controller.offline ? (
          <p className="connection-status" role="status">Host 连接中断；当前为只读状态。</p>
        ) : null}
      </section>

      <nav className="widget-launchers" aria-label="老虎机工具">
        <button type="button" className="pixel-button" aria-expanded={utilityPanel === "collection"} onClick={() => toggleUtilityPanel("collection")}>{displayMode === "companion" ? "收藏" : "打开收藏盒"}</button>
        <button type="button" className="pixel-button" aria-expanded={utilityPanel === "shop"} onClick={() => toggleUtilityPanel("shop")}>{displayMode === "companion" ? "商店" : "打开商店"}</button>
        <button type="button" className="pixel-button" aria-expanded={utilityPanel === "settings"} onClick={() => toggleUtilityPanel("settings")}>{displayMode === "companion" ? "设置" : "打开设置"}</button>
      </nav>

      <div className="plugin-game-layout">
        <div className="slot-widget-frame">
          <section className="slot-widget" data-scale={scale} aria-label="老虎机微缩场景">
            <GameCanvas
              state={controller.gameState}
              mode={controller.mutationsDisabled ? "readonly" : "writer"}
              error={controller.error}
              onPlay={() => { void controller.play(); }}
              onSetPlacement={(itemId, positionId) => { void controller.setPlacement(itemId, positionId); }}
              onAnimationEvent={(event) => { void controller.advanceAnimation(event); }}
              loadAssets={loadExplicitAssets}
            />
          </section>
        </div>
        <div className="utility-panel-slot">
          <CollectionPanel
            open={utilityPanel === "collection"}
            state={controller.gameState}
            onClose={() => setUtilityPanel(null)}
            onSetPlacement={(itemId, positionId) => { void controller.setPlacement(itemId, positionId); }}
            mutationsDisabled={controller.mutationsDisabled}
            collectiblesUrl={assetUrls.collectibles}
          />
          <ShopPanel
            open={utilityPanel === "shop"}
            state={controller.gameState}
            onClose={() => setUtilityPanel(null)}
            onBuy={(itemId) => { void controller.buy(itemId); }}
            mutationsDisabled={controller.mutationsDisabled}
            collectiblesUrl={assetUrls.collectibles}
          />
          <SettingsPanel
            open={utilityPanel === "settings"}
            settings={controller.gameState.settings}
            onClose={() => setUtilityPanel(null)}
            onChange={(patch) => { void controller.setSettings(patch); }}
            allowDoubleScale={doubleScaleAvailable}
            mutationsDisabled={controller.mutationsDisabled}
          />
        </div>
      </div>
      </div>
      {displayMode === "companion" ? (["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((corner) => (
        <span
          key={corner}
          className={`companion-resize-grip companion-resize-grip--${corner}`}
          aria-hidden="true"
        />
      )) : null}
    </main>
  );
}

function clampCompanionScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_COMPANION_SCALE, Math.max(MIN_COMPANION_SCALE, value));
}

export function normalizeCompanionScale(value: number): number {
  if (Math.abs(value - 1) < 0.025) return 1;
  return Math.round(value * 100) / 100;
}
