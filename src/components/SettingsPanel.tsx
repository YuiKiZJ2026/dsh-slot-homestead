import { useEffect, useState } from "react";
import type { GameSettings } from "../domain/types";
import { PanelHeader } from "./CollectionPanel";

export interface SettingsPanelProps {
  open: boolean;
  settings: GameSettings;
  onClose(): void;
  onChange(patch: Partial<GameSettings>): void;
  allowDoubleScale?: boolean;
  mutationsDisabled?: boolean;
}

const DOUBLE_SCALE_MIN_WIDTH = 1_536;
const DOUBLE_SCALE_MIN_HEIGHT = 960;

export function viewportAllowsDoubleScale(width: number, height: number): boolean {
  return width >= DOUBLE_SCALE_MIN_WIDTH && height >= DOUBLE_SCALE_MIN_HEIGHT;
}

export function useDoubleScaleAvailability(): boolean {
  const [available, setAvailable] = useState(() => viewportAllowsDoubleScale(
    globalThis.innerWidth,
    globalThis.innerHeight,
  ));

  useEffect(() => {
    const refresh = (): void => setAvailable(viewportAllowsDoubleScale(
      globalThis.innerWidth,
      globalThis.innerHeight,
    ));
    globalThis.addEventListener("resize", refresh);
    return () => globalThis.removeEventListener("resize", refresh);
  }, []);

  return available;
}

export function SettingsPanel({
  open,
  settings,
  onClose,
  onChange,
  allowDoubleScale = viewportAllowsDoubleScale(globalThis.innerWidth, globalThis.innerHeight),
  mutationsDisabled = false,
}: SettingsPanelProps) {
  if (!open) return null;

  return (
    <section className="utility-panel settings-panel" role="dialog" aria-label="设置">
      <PanelHeader title="设置" closeLabel="关闭设置" onClose={onClose} />
      <label className="setting-row">
        <input
          type="checkbox"
          checked={settings.muted}
          disabled={mutationsDisabled}
          onChange={(event) => onChange({ muted: event.currentTarget.checked })}
        />
        <span>静音</span>
      </label>
      <label className="setting-row">
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          disabled={mutationsDisabled}
          onChange={(event) => onChange({ reducedMotion: event.currentTarget.checked })}
        />
        <span>减少动态效果</span>
      </label>
      <fieldset className="scale-picker">
        <legend>像素倍率</legend>
        <button
          type="button"
          className="pixel-button"
          aria-pressed={settings.scale === 1 || !allowDoubleScale}
          disabled={mutationsDisabled}
          onClick={() => onChange({ scale: 1 })}
        >1 倍</button>
        {allowDoubleScale ? (
          <button
            type="button"
            className="pixel-button"
            aria-pressed={settings.scale === 2}
            disabled={mutationsDisabled}
            onClick={() => onChange({ scale: 2 })}
          >2 倍</button>
        ) : null}
      </fieldset>
    </section>
  );
}
