import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CollectionPanel } from "../components/CollectionPanel";
import { DaylightStatus } from "../components/DaylightStatus";
import { EcosystemScene } from "../components/EcosystemScene";
import { DemoPanel } from "../components/DemoPanel";
import { GameCanvas } from "../components/GameCanvas";
import { NightSky } from "../components/NightSky";
import { SettingsPanel, useDoubleScaleAvailability } from "../components/SettingsPanel";
import { ShopPanel } from "../components/ShopPanel";
import { SpinResultCard } from "../components/SpinResultCard";
import { WorkbenchCommandBar, WorkbenchToolTray, type WorkbenchUtilityPanel } from "../components/WorkbenchCommandBar";
import type { DshAdapter } from "../dsh/adapter";
import type { DshDemoControls } from "../dsh/demo-controls";
import { MockDshAdapter } from "../dsh/mock-adapter";
import type { ResolvedSpin } from "../domain/types";
import { mathRandomSource } from "../game/rng";
import { hasStarryNightTheme } from "../inventory/inventory";
import { StateRepository } from "../storage/repository";
import {
  acquireWriterLock,
  type LockManagerLike,
  type WriterMode,
} from "../storage/writer-lock";
import { OffsetSystemClock, SystemClock, type Clock } from "../time/clock";
import { useDayPhase } from "../time/use-day-phase";
import { CONTROL_DECK_RENDER_HEIGHT, WIDGET_RENDER_HEIGHT, WIDGET_RENDER_WIDTH } from "../ui/widget-layout";
import { useGameController } from "./use-game-controller";

type UtilityPanel = WorkbenchUtilityPanel;

export interface AppRuntime {
  repository: StateRepository;
  clock: Clock;
  adapter: DshAdapter;
  demoControls?: DshDemoControls;
  createId(): string;
}

export interface AppProps {
  createRuntime?: () => AppRuntime;
  lightingClock?: Clock;
}

const DEFAULT_LIGHTING_CLOCK = new SystemClock();

export function App({
  createRuntime = createDefaultRuntime,
  lightingClock = DEFAULT_LIGHTING_CLOCK,
}: AppProps = {}) {
  const [runtime] = useState(createRuntime);
  const dayPhase = useDayPhase(lightingClock);
  const demoControls = runtime.demoControls;
  const mode = useWriterMode(browserLockManager());
  const controller = useGameController({
    repository: runtime.repository,
    adapter: runtime.adapter,
    clock: runtime.clock,
    rng: mathRandomSource,
    createId: runtime.createId,
    consumeOutcomeOverride: import.meta.env.DEV && demoControls !== undefined
      ? () => demoControls.consumeNextOutcome()
      : undefined,
    mode,
  });
  const [demoOpen, setDemoOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel | null>(null);
  const [lastSpinResult, setLastSpinResult] = useState<ResolvedSpin | null>(null);
  const doubleScaleAvailable = useDoubleScaleAvailability();
  const scale = controller.state.settings.scale === 2 && doubleScaleAvailable ? 2 : 1;
  const currentLedger = controller.state.lastAwardDate === null
    ? undefined
    : controller.state.dailyLedgers[controller.state.lastAwardDate];
  const desktopStyle = {
    "--widget-scale": scale,
    "--widget-width": `${WIDGET_RENDER_WIDTH * scale}px`,
    "--widget-height": `${WIDGET_RENDER_HEIGHT * scale}px`,
    "--control-deck-height": `${CONTROL_DECK_RENDER_HEIGHT * scale}px`,
  } as CSSProperties;
  const desktopClass = [
    "desktop",
    hasStarryNightTheme(controller.state) ? "desktop--starry" : "",
    utilityPanel !== null || lastSpinResult !== null ? "has-utility-panel" : "",
  ].filter(Boolean).join(" ");

  const toggleUtilityPanel = (panel: UtilityPanel): void => {
    setLastSpinResult(null);
    setUtilityPanel((current) => current === panel ? null : panel);
  };

  return (
    <main
      className={desktopClass}
      style={desktopStyle}
      role="application"
      aria-label="DSH 桌面老虎机"
      data-day-phase={dayPhase}
    >
      <div className="desktop__ambient" aria-hidden="true" />
      <DaylightStatus phase={dayPhase} />

      <div className="wallet-status" aria-live="polite">
        <span>钱包</span>
        <strong data-testid="wallet-count">{controller.state.wallet}</strong>
        <span>枚</span>
      </div>

      {demoControls === undefined ? null : (
        <>
          <button
            type="button"
            className="pixel-button demo-launcher"
            aria-expanded={demoOpen}
            onClick={() => setDemoOpen((open) => !open)}
          >打开演示控制台</button>

          <div className="demo-panel-frame">
            <DemoPanel
              open={demoOpen}
              onClose={() => setDemoOpen(false)}
              onCompleteTask={() => demoControls.completeTask()}
              onVerifyTask={(taskId) => demoControls.verifyTask(taskId)}
              onAddFocusHour={() => demoControls.addFocusHour()}
              onSetStatus={(status) => demoControls.setAgentStatus(status)}
              onAdvanceDay={() => {
                demoControls.advanceDay();
                controller.refreshForCurrentDate();
              }}
              onReset={controller.resetPrototype}
              onPresetNextOutcome={import.meta.env.DEV
                ? (outcome) => demoControls.presetNextOutcome(outcome)
                : undefined}
              state={controller.state}
              dailyWorkCoins={currentLedger?.workCoins ?? 0}
              focusCoins={currentLedger?.focusCoins ?? 0}
              focusMinutes={currentLedger?.focusMinutes ?? 0}
              pityMisses={controller.state.pityMisses}
              lastEvent={controller.lastEvent}
              mode={mode}
            />
          </div>
        </>
      )}

      {demoControls !== undefined && mode === "readonly" ? (
        <aside
          className="readonly-sandbox-notice"
          role="status"
          aria-label="只读测试提示"
        >
          <span>当前页是只读副本，经济操作已停用。</span>
          <a className="pixel-button readonly-sandbox-notice__link" href="/native-preview.html">
            打开独立测试沙盒
          </a>
        </aside>
      ) : null}

      <div className="utility-panel-slot">
        <CollectionPanel
          open={utilityPanel === "collection"}
          state={controller.state}
          onClose={() => setUtilityPanel(null)}
          onSetPlacement={controller.setPlacement}
        />
        <ShopPanel
          open={utilityPanel === "shop"}
          state={controller.state}
          onClose={() => setUtilityPanel(null)}
          onBuy={controller.buy}
        />
        <SettingsPanel
          open={utilityPanel === "settings"}
          settings={controller.state.settings}
          onClose={() => setUtilityPanel(null)}
          onChange={controller.setSettings}
          allowDoubleScale={doubleScaleAvailable}
        />
        {utilityPanel === null && lastSpinResult !== null ? (
          <SpinResultCard
            spin={lastSpinResult}
            state={controller.state}
            onDismiss={() => setLastSpinResult(null)}
            onPlace={controller.setPlacement}
          />
        ) : null}
      </div>

      <section
        className="ecosystem-widget"
        data-scale={scale}
        data-composition="single-workbench-v3"
        aria-label="老虎机与养成生态"
      >
        <EcosystemScene
          state={controller.state}
          dayPhase={dayPhase}
          onCare={controller.care}
          onCollect={controller.collect}
          mutationsDisabled={mode !== "writer"}
          nightSky={(
            <>
              <NightSky />
              <span
                className="ecosystem-widget__moonlight"
                data-night-moonlight="workbench"
                aria-hidden="true"
              />
            </>
          )}
          commandBar={(
            <WorkbenchCommandBar
              state={controller.state}
            />
          )}
        />
        <div className="slot-widget" aria-label="老虎机微缩场景">
          <GameCanvas
            state={controller.state}
            mode={mode}
            error={controller.error}
            onPlay={() => {
              setLastSpinResult(null);
              controller.play();
            }}
            onSetPlacement={controller.setPlacement}
            onSettledResult={setLastSpinResult}
            onAnimationEvent={controller.advanceAnimation}
            includeSceneBase={false}
          />
          <WorkbenchToolTray
            activePanel={utilityPanel}
            onToggle={toggleUtilityPanel}
          />
        </div>
      </section>
    </main>
  );
}

function createDefaultRuntime(): AppRuntime {
  const clock = new OffsetSystemClock();
  const createId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `dsh-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
  const adapter = new MockDshAdapter(clock, createId);
  return {
    repository: new StateRepository(globalThis.localStorage),
    clock,
    adapter,
    demoControls: adapter,
    createId,
  };
}

function browserLockManager(): LockManagerLike | undefined {
  try {
    return navigator.locks as unknown as LockManagerLike | undefined;
  } catch {
    return undefined;
  }
}

function useWriterMode(locks: LockManagerLike | undefined): WriterMode {
  const [mode, setMode] = useState<WriterMode>("unsupported");
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let disposed = false;
    let releaseLease: (() => void) | null = null;

    queueMicrotask(() => {
      if (disposed || generationRef.current !== generation) return;
      void acquireWriterLock(locks, (nextMode) => {
        if (!disposed && generationRef.current === generation) setMode(nextMode);
      }).then((lease) => {
        if (disposed || generationRef.current !== generation) {
          lease.release();
          return;
        }
        releaseLease = lease.release;
      }).catch(() => {
        if (!disposed && generationRef.current === generation) setMode("unsupported");
      });
    });

    return () => {
      disposed = true;
      releaseLease?.();
    };
  }, [locks]);

  return mode;
}
