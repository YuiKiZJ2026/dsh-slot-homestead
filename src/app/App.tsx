import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CollectionPanel } from "../components/CollectionPanel";
import { DemoPanel } from "../components/DemoPanel";
import { GameCanvas } from "../components/GameCanvas";
import { SettingsPanel, useDoubleScaleAvailability } from "../components/SettingsPanel";
import { ShopPanel } from "../components/ShopPanel";
import type { DshAdapter } from "../dsh/adapter";
import type { DshDemoControls } from "../dsh/demo-controls";
import { MockDshAdapter } from "../dsh/mock-adapter";
import { mathRandomSource } from "../game/rng";
import { hasStarryNightTheme } from "../inventory/inventory";
import { StateRepository } from "../storage/repository";
import {
  acquireWriterLock,
  type LockManagerLike,
  type WriterMode,
} from "../storage/writer-lock";
import { FixedClock, SystemClock, type Clock } from "../time/clock";
import { useGameController } from "./use-game-controller";

type UtilityPanel = "collection" | "shop" | "settings";

export interface AppRuntime {
  repository: StateRepository;
  clock: Clock;
  adapter: DshAdapter;
  demoControls?: DshDemoControls;
  createId(): string;
}

export interface AppProps {
  createRuntime?: () => AppRuntime;
}

export function App({ createRuntime = createDefaultRuntime }: AppProps = {}) {
  const [runtime] = useState(createRuntime);
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
  const doubleScaleAvailable = useDoubleScaleAvailability();
  const scale = controller.state.settings.scale === 2 && doubleScaleAvailable ? 2 : 1;
  const currentLedger = controller.state.lastAwardDate === null
    ? undefined
    : controller.state.dailyLedgers[controller.state.lastAwardDate];
  const desktopStyle = {
    "--widget-scale": scale,
    "--widget-width": `${384 * scale}px`,
    "--widget-height": `${288 * scale}px`,
  } as CSSProperties;
  const desktopClass = hasStarryNightTheme(controller.state)
    ? "desktop desktop--starry"
    : "desktop";

  const toggleUtilityPanel = (panel: UtilityPanel): void => {
    setUtilityPanel((current) => current === panel ? null : panel);
  };

  return (
    <main
      className={desktopClass}
      style={desktopStyle}
      role="application"
      aria-label="DSH 桌面老虎机"
    >
      <div className="desktop__ambient" aria-hidden="true" />

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

      <nav className="widget-launchers" aria-label="老虎机工具">
        <button
          type="button"
          className="pixel-button"
          aria-expanded={utilityPanel === "collection"}
          onClick={() => toggleUtilityPanel("collection")}
        >打开收藏盒</button>
        <button
          type="button"
          className="pixel-button"
          aria-expanded={utilityPanel === "shop"}
          onClick={() => toggleUtilityPanel("shop")}
        >打开商店</button>
        <button
          type="button"
          className="pixel-button"
          aria-expanded={utilityPanel === "settings"}
          onClick={() => toggleUtilityPanel("settings")}
        >打开设置</button>
      </nav>

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
      </div>

      <section className="slot-widget" data-scale={scale} aria-label="老虎机微缩场景">
        <GameCanvas
          state={controller.state}
          mode={mode}
          error={controller.error}
          onPlay={controller.play}
          onSetPlacement={controller.setPlacement}
          onAnimationEvent={controller.advanceAnimation}
        />
      </section>
    </main>
  );
}

function createDefaultRuntime(): AppRuntime {
  const systemClock = new SystemClock();
  const clock = new FixedClock(systemClock.now());
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
