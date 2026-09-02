import { useState } from "react";
import type { GameState } from "../domain/types";
import { CurrentGoal } from "./CurrentGoal";

export type WorkbenchUtilityPanel = "collection" | "shop" | "settings";

export function WorkbenchCommandBar({
  state,
  tokenProgress,
}: {
  state: GameState;
  tokenProgress?: number;
}) {
  return (
    <section className="workbench-command-bar" role="region" aria-label="工作台控制">
      <CurrentGoal state={state} tokenProgress={tokenProgress} />
    </section>
  );
}

export function WorkbenchToolTray({
  activePanel,
  compactLabels = false,
  onToggle,
}: {
  activePanel: WorkbenchUtilityPanel | null;
  compactLabels?: boolean;
  onToggle(panel: WorkbenchUtilityPanel): void;
}) {
  const [open, setOpen] = useState(false);
  const selectPanel = (panel: WorkbenchUtilityPanel): void => {
    setOpen(false);
    onToggle(panel);
  };

  return (
    <div className="slot-tool-console" data-open={open}>
      <button
        type="button"
        className="slot-tool-console__trigger"
        aria-label="打开老虎机工具抽屉"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >工具</button>
      {open ? <nav className="widget-launchers" aria-label="老虎机工具">
        <button
          type="button"
          className="pixel-button pixel-button--compact"
          aria-label="打开收藏盒"
          aria-expanded={activePanel === "collection"}
          onClick={() => selectPanel("collection")}
        >{compactLabels ? "收藏" : "收藏盒"}</button>
        <button
          type="button"
          className="pixel-button pixel-button--compact"
          aria-label="打开工坊"
          aria-expanded={activePanel === "shop"}
          onClick={() => selectPanel("shop")}
        >工坊</button>
        <button
          type="button"
          className="pixel-button pixel-button--compact"
          aria-label="打开设置"
          aria-expanded={activePanel === "settings"}
          onClick={() => selectPanel("settings")}
        >设置</button>
      </nav> : null}
    </div>
  );
}
