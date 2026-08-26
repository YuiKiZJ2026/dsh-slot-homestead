import { useCallback, useState, type CSSProperties } from "react";
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

export interface PluginAppProps {
  api: GameApi;
  sessionId: string;
  assetUrls: SceneAssetUrls;
  loadAssets?: () => Promise<SceneAssets>;
}

export function PluginApp({ api, sessionId, assetUrls, loadAssets }: PluginAppProps) {
  const controller = useHostGameController({ api, sessionId });
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel | null>(null);
  const doubleScaleAvailable = useDoubleScaleAvailability();
  const scale = controller.gameState.settings.scale === 2 && doubleScaleAvailable ? 2 : 1;
  const rootStyle = {
    "--widget-scale": scale,
    "--widget-width": `${384 * scale}px`,
    "--widget-height": `${288 * scale}px`,
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
  const rootClass = hasStarryNightTheme(controller.gameState)
    ? "dsh-slot-widget-root desktop desktop--starry"
    : "dsh-slot-widget-root desktop";

  return (
    <main className={rootClass} style={rootStyle} role="application" aria-label="DSH 桌面老虎机">
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
        <button type="button" className="pixel-button" aria-expanded={utilityPanel === "collection"} onClick={() => toggleUtilityPanel("collection")}>打开收藏柜</button>
        <button type="button" className="pixel-button" aria-expanded={utilityPanel === "shop"} onClick={() => toggleUtilityPanel("shop")}>打开商店</button>
        <button type="button" className="pixel-button" aria-expanded={utilityPanel === "settings"} onClick={() => toggleUtilityPanel("settings")}>打开设置</button>
      </nav>

      <div className="plugin-game-layout">
        <div className="slot-widget-frame">
          <section className="slot-widget" data-scale={scale} aria-label="老虎机微缩场景">
            <GameCanvas
              state={controller.gameState}
              mode={controller.mutationsDisabled ? "readonly" : "writer"}
              error={controller.error}
              onInsertCoin={controller.insertCoin}
              onPullLever={controller.pullLever}
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
            onSetDisplayed={(itemId, displayed) => { void controller.setDisplayed(itemId, displayed); }}
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
    </main>
  );
}
