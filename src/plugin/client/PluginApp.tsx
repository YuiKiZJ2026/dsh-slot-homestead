import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { CollectionPanel } from "../../components/CollectionPanel";
import { DaylightStatus } from "../../components/DaylightStatus";
import { EcosystemScene, type EcosystemAssetUrls } from "../../components/EcosystemScene";
import { GameCanvas } from "../../components/GameCanvas";
import { NightSky } from "../../components/NightSky";
import { SettingsPanel, useDoubleScaleAvailability } from "../../components/SettingsPanel";
import { ShopPanel } from "../../components/ShopPanel";
import { SpinResultCard } from "../../components/SpinResultCard";
import { WorkbenchCommandBar, WorkbenchToolTray, type WorkbenchUtilityPanel } from "../../components/WorkbenchCommandBar";
import type { ResolvedSpin } from "../../domain/types";
import { hasStarryNightTheme } from "../../inventory/inventory";
import { SystemClock, type Clock } from "../../time/clock";
import { useDayPhase } from "../../time/use-day-phase";
import { CONTROL_DECK_RENDER_HEIGHT, WIDGET_RENDER_HEIGHT, WIDGET_RENDER_WIDTH } from "../../ui/widget-layout";
import { loadSceneAssets, type SceneAssets, type SceneAssetUrls } from "../../game/renderer/assets";
import type { GameApi } from "./api";
import { TokenEnergyMeter } from "./TokenEnergyMeter";
import { useHostGameController } from "./use-host-game-controller";
import { HomesteadJournal } from "../../components/HomesteadJournal";
import { CollectibleSprite } from "../../components/CollectionPanel";
import { CATALOG_BY_ID } from "../../domain/catalog";
import { getJournalQuests } from "../../ecosystem/journal";
import { HOMESTEAD_STYLE } from "../../ui/homestead-style";
import { HomesteadFeedback } from "../../components/HomesteadFeedback";
import { WorldClock } from "../../components/WorldClock";
import { MerchantPanel } from "../../components/MerchantPanel";
import { worldDate, worldView } from "../../ecosystem/world-clock";
import { resolveDayPhaseAtHour } from "../../time/day-phase";
import { WORLD_STYLE } from "../../ui/world-style";

type UtilityPanel = WorkbenchUtilityPanel;
const COMPANION_BASE_WIDTH = 560;
const COMPANION_COMPACT_HEIGHT = 384;
const COMPANION_PANEL_HEIGHT = 496;
const MIN_COMPANION_SCALE = 0.75;
const MAX_COMPANION_SCALE = 1.6;
const DEFAULT_LIGHTING_CLOCK = new SystemClock();

export interface PluginAppProps {
  api: GameApi;
  sessionId: string;
  assetUrls: SceneAssetUrls;
  ecosystemAssetUrls?: EcosystemAssetUrls;
  loadAssets?: () => Promise<SceneAssets>;
  displayMode?: "page" | "overlay" | "companion";
  lightingClock?: Clock;
  refreshToken?: number;
}

export function PluginApp({
  api,
  sessionId,
  assetUrls,
  ecosystemAssetUrls,
  loadAssets,
  displayMode = "page",
  lightingClock,
  refreshToken = 0,
}: PluginAppProps) {
  const controller = useHostGameController({ api, sessionId });
  useEffect(() => {
    if (refreshToken > 0) void controller.refresh();
  }, [controller.refresh, refreshToken]);
  const previewPhase = useDayPhase(lightingClock ?? DEFAULT_LIGHTING_CLOCK);
  const dayPhase = lightingClock ? previewPhase : resolveDayPhaseAtHour(worldView(controller.gameState.ecosystem.world).hour);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel | null>(null);
  const [journalChapter, setJournalChapter] = useState<"today" | "garden">("today");
  const [lastSpinResult, setLastSpinResult] = useState<ResolvedSpin | null>(null);
  const [companionViewport, setCompanionViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const doubleScaleAvailable = useDoubleScaleAvailability();
  const detailOpen = utilityPanel !== null || lastSpinResult !== null;
  const companionBaseHeight = !detailOpen
    ? COMPANION_COMPACT_HEIGHT
    : COMPANION_PANEL_HEIGHT;
  const companionScale = clampCompanionScale(Math.min(
    companionViewport.width / COMPANION_BASE_WIDTH,
    companionViewport.height / companionBaseHeight,
  ));
  const scale = displayMode === "companion"
    ? !detailOpen ? 0.86 : 0.84
    : controller.gameState.settings.scale === 2 && doubleScaleAvailable ? 2 : 1;
  const rootStyle = {
    "--widget-scale": scale,
    "--widget-width": `${WIDGET_RENDER_WIDTH * scale}px`,
    "--widget-height": `${WIDGET_RENDER_HEIGHT * scale}px`,
    "--control-deck-height": `${CONTROL_DECK_RENDER_HEIGHT * scale}px`,
    "--companion-scale": companionScale,
    "--companion-base-height": `${companionBaseHeight}px`,
  } as CSSProperties;
  const loadExplicitAssets = useCallback(
    () => loadAssets === undefined ? loadSceneAssets(assetUrls) : loadAssets(),
    [assetUrls, loadAssets],
  );
  const snapshot = controller.snapshot;
  const journalDate = controller.gameState.ecosystem.world ? worldDate(controller.gameState.ecosystem.world).toISOString().slice(0,10) : snapshot?.localDate ?? new Date().toLocaleDateString("en-CA");
  const readyQuests = getJournalQuests(controller.gameState, new Date(`${journalDate}T12:00:00`))
    .filter(quest => !quest.claimed && quest.progress >= quest.target).length;
  const dailyTokenCoins = snapshot === null
    ? 0
    : snapshot.tokenEnergy.dailyCoins[snapshot.localDate] ?? 0;
  const toggleUtilityPanel = (panel: UtilityPanel): void => {
    setLastSpinResult(null);
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
    const nextHash = !detailOpen ? "#compact" : "#panel";
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }, [detailOpen, displayMode]);
  const rootClass = [
    "dsh-slot-widget-root",
    "desktop",
    displayMode === "overlay" ? "desktop--overlay" : "desktop--page",
    displayMode === "companion" ? "desktop--companion" : "",
    detailOpen ? "has-utility-panel" : "",
    hasStarryNightTheme(controller.gameState) ? "desktop--starry" : "",
  ].filter(Boolean).join(" ");

  return (
    <main
      className={rootClass}
      style={rootStyle}
      role="application"
      aria-label="老虎机庄园｜桌面像素生态养成"
      data-display-mode={displayMode}
      data-day-phase={dayPhase}
      data-reduced-motion={controller.gameState.settings.reducedMotion}
    >
      {displayMode === "companion" ? (
        <button type="button" className="edge-reveal-tab" aria-label="展开老虎机">◆</button>
      ) : null}
      <div className={displayMode === "companion" ? "companion-scale-surface" : "plugin-content-surface"}>
      <div className="desktop__ambient" aria-hidden="true" />
      {displayMode === "page" ? <DaylightStatus phase={dayPhase} source={lightingClock ? "预览" : "庄园"} /> : null}
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

      <div className="plugin-game-layout">
        <style>{HOMESTEAD_STYLE}</style>
        <style>{WORLD_STYLE}</style>
        <div className="slot-widget-frame">
          <section
            className="ecosystem-widget"
            data-scale={scale}
            data-composition="single-workbench-v3"
            aria-label="老虎机庄园：老虎机与养成生态"
          >
            <EcosystemScene
              state={controller.gameState}
              dayPhase={dayPhase}
              onCare={(habitat) => { void controller.care(habitat); }}
              onCollect={(habitat) => { void controller.collect(habitat); }}
              onOpenPlanting={() => { setJournalChapter("garden"); setUtilityPanel("journal"); }}
              mutationsDisabled={controller.mutationsDisabled}
              assetUrls={ecosystemAssetUrls}
              nightSky={displayMode === "page" ? (
                <>
                  <NightSky />
                  <span
                    className="ecosystem-widget__moonlight"
                    data-night-moonlight="workbench"
                    aria-hidden="true"
                  />
                </>
              ) : null}
              commandBar={(
                <WorkbenchCommandBar
                  state={controller.gameState}
                  tokenProgress={snapshot?.tokenEnergy.progress}
                  worldControl={<WorldClock ecosystem={controller.gameState.ecosystem} open={utilityPanel === "merchant"} onOpen={()=>toggleUtilityPanel("merchant")} />}
                  journalControl={(
                    <button type="button" className="journal-desk-book" aria-label="打开庄园手账" aria-expanded={utilityPanel === "journal"} onClick={() => { setJournalChapter("today"); toggleUtilityPanel("journal"); }} title="庄园手账 · 委托、足迹与种植计划">
                      <CollectibleSprite item={CATALOG_BY_ID["book-stand"]} owned imageUrl={assetUrls.collectibles} />
                      <span className="journal-desk-book__label">庄园手账</span>
                      {readyQuests > 0 ? <span className="journal-desk-book__badge" aria-label={`${readyQuests}份奖励待领取`}>{readyQuests}</span> : null}
                    </button>
                  )}
                />
              )}
            />
            <div className="slot-widget" aria-label="老虎机庄园微缩场景">
            <GameCanvas
              state={controller.gameState}
              mode={controller.mutationsDisabled ? "readonly" : "writer"}
              error={controller.error}
              onPlay={() => {
                setLastSpinResult(null);
                void controller.play();
              }}
              onSetPlacement={(itemId, positionId) => { void controller.setPlacement(itemId, positionId); }}
              onSettledResult={setLastSpinResult}
              onAnimationEvent={(event) => { void controller.advanceAnimation(event); }}
              loadAssets={loadExplicitAssets}
              includeSceneBase={false}
            />
            <WorkbenchToolTray
              activePanel={utilityPanel}
              compactLabels={displayMode === "companion"}
              onToggle={toggleUtilityPanel}
            />
            </div>
          </section>
        </div>
        <div className="utility-panel-slot">
          <MerchantPanel open={utilityPanel === "merchant"} state={controller.gameState} disabled={controller.mutationsDisabled} error={controller.error}
            onClose={()=>setUtilityPanel(null)} onBuy={(id,visitId)=>{void controller.merchantBuy(id,visitId);}}
            onSell={(habitat,visitId)=>{void controller.merchantSell(habitat,visitId);}} assetUrls={ecosystemAssetUrls} />
          <HomesteadJournal open={utilityPanel === "journal"} state={controller.gameState} date={journalDate} initialChapter={journalChapter}
            disabled={controller.mutationsDisabled} error={controller.error} onClose={() => setUtilityPanel(null)}
            assetUrls={ecosystemAssetUrls} onCancelPlanting={plotId => { void controller.cancelPlanting(plotId); }} onHarvest={() => { void controller.collect("garden"); }}
            onClaim={id => { void controller.claimJournal(id); }} onPlant={(plotId, seedId) => { void controller.plant(plotId, seedId); }} />
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
            assetUrls={ecosystemAssetUrls}
          />
          <SettingsPanel
            open={utilityPanel === "settings"}
            settings={controller.gameState.settings}
            onClose={() => setUtilityPanel(null)}
            onChange={(patch) => { void controller.setSettings(patch); }}
            allowDoubleScale={doubleScaleAvailable}
            mutationsDisabled={controller.mutationsDisabled}
          />
          {utilityPanel === null && lastSpinResult !== null ? (
            <SpinResultCard
              spin={lastSpinResult}
              state={controller.gameState}
              onDismiss={() => setLastSpinResult(null)}
              onPlace={(itemId, positionId) => { void controller.setPlacement(itemId, positionId); }}
              collectiblesUrl={assetUrls.collectibles}
            />
          ) : null}
        </div>
      </div>
      <HomesteadFeedback state={controller.gameState} ready={snapshot !== null} />
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
