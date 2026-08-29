export const PLUGIN_STYLE = `
.dsh-slot-widget-root,
.dsh-slot-widget-root *,
.dsh-slot-widget-root *::before,
.dsh-slot-widget-root *::after { box-sizing: border-box; }
.dsh-slot-widget-root { --widget-scale: 1; --widget-width: 384px; --widget-height: 288px; position: relative; isolation: isolate; min-height: 640px; overflow: auto; padding: 18px; color: #f7ddb0; background: radial-gradient(circle at 74% 28%, rgba(31,74,103,.28), transparent 31%), linear-gradient(145deg,#07142c,#091b32 54%,#050d1d); font-family: "SFMono-Regular", "Cascadia Mono", "Noto Sans Mono CJK SC", monospace; font-synthesis: none; }
.dsh-slot-widget-root .desktop__ambient { position: absolute; inset: 0; z-index: -1; opacity: .22; background-image: linear-gradient(rgba(92,151,167,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(92,151,167,.04) 1px,transparent 1px); background-size: 24px 24px; }
.dsh-slot-widget-root.desktop--starry .desktop__ambient { opacity: .42; background-image: radial-gradient(circle,rgba(255,222,124,.8) 0 1px,transparent 1px),radial-gradient(circle,rgba(79,211,202,.65) 0 1px,transparent 1px); background-size: 73px 67px,97px 89px; }
.dsh-slot-widget-root button,
.dsh-slot-widget-root input { font: inherit; }
.dsh-slot-widget-root button:focus-visible,
.dsh-slot-widget-root input:focus-visible { outline: 3px solid #ffe37b; outline-offset: 2px; }
.dsh-slot-widget-root .host-status { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; max-width: 760px; margin: 0 auto 14px; border-bottom: 2px solid #91602d; padding: 8px 10px; color: #d8c69c; background: rgba(6,17,38,.86); font-size: 12px; }
.dsh-slot-widget-root .wallet-status { display: flex; align-items: baseline; gap: 7px; }
.dsh-slot-widget-root .wallet-status strong { color: #ffd55e; font-size: 19px; }
.dsh-slot-widget-root .token-energy-meter { display: grid; flex: 1 1 300px; gap: 4px; }
.dsh-slot-widget-root .token-energy-meter__label { display: grid; grid-template-columns: minmax(180px,auto) minmax(100px,1fr); align-items: center; gap: 8px; }
.dsh-slot-widget-root .token-energy-meter progress { width: 100%; height: 10px; accent-color: #54d3c6; }
.dsh-slot-widget-root .token-energy-meter__daily { color: #8fd7cd; }
.dsh-slot-widget-root .reward-source-status { flex-basis: 100%; margin: 0; color: #a9b6ca; }
.dsh-slot-widget-root .connection-status { flex-basis: 100%; margin: 0; color: #ffc26b; }
.dsh-slot-widget-root .pixel-button { min-height: 30px; border: 2px solid #7e9ba3; border-radius: 2px; padding: 5px 9px; color: #f9e5bc; background: #142641; box-shadow: inset 0 -2px #09152a,inset 0 2px rgba(117,218,205,.12); cursor: pointer; }
.dsh-slot-widget-root .pixel-button:hover:not(:disabled),
.dsh-slot-widget-root .pixel-button[aria-pressed="true"] { border-color: #e6a63e; color: #fff2c6; background: #263453; }
.dsh-slot-widget-root .pixel-button:disabled { cursor: not-allowed; opacity: .48; }
.dsh-slot-widget-root .pixel-button--compact { min-width: 58px; min-height: 26px; padding: 3px 6px; font-size: 11px; }
.dsh-slot-widget-root .widget-launchers { display: flex; justify-content: center; gap: 6px; margin-bottom: 8px; }
.dsh-slot-widget-root .plugin-content-surface { display: contents; }
.dsh-slot-widget-root .plugin-game-layout { display: grid; grid-template-columns: minmax(0,384px) minmax(280px,344px); justify-content: center; align-items: end; gap: 12px; }
.dsh-slot-widget-root .slot-widget { width: 384px; height: 288px; transform: scale(var(--widget-scale)); transform-origin: top left; background: transparent; }
.dsh-slot-widget-root .slot-widget-frame { width: var(--widget-width); height: var(--widget-height); }
.dsh-slot-widget-root .slot-widget canvas { display: block; width: 384px; height: 288px; image-rendering: pixelated; }
.dsh-slot-widget-root .game-canvas-wrap { position: relative; width: 384px; height: 288px; }
.dsh-slot-widget-root .table-drop-hit-zones { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.dsh-slot-widget-root .table-drop-hit-zone { position: absolute; pointer-events: auto; }
.dsh-slot-widget-root .table-drop-hit-zone--left { top: 70px; bottom: 18px; left: 0; width: 128px; }
.dsh-slot-widget-root .table-drop-hit-zone--right { top: 78px; right: 0; bottom: 18px; width: 120px; }
.dsh-slot-widget-root .table-drop-hit-zone--front { right: 74px; bottom: 18px; left: 80px; height: 92px; }
.dsh-slot-widget-root .table-placement-layer { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.dsh-slot-widget-root .table-snap-target { position: absolute; width: 34px; height: 16px; border: 2px dashed transparent; border-radius: 50%; transform: translate(-50%,-50%); transition: border-color 90ms ease,background 90ms ease,transform 90ms ease; }
.dsh-slot-widget-root .game-canvas-wrap.is-placing .table-snap-target { border-color: rgba(95,218,202,.4); background: rgba(34,123,121,.14); }
.dsh-slot-widget-root .table-snap-target[data-snap="true"] { border-color: #ffe06a; background: rgba(255,196,65,.36); box-shadow: 0 0 0 3px rgba(32,217,188,.22),0 0 12px rgba(255,210,80,.78); transform: translate(-50%,-50%) scale(1.16); animation: dsh-slot-magnet 520ms steps(2,end) infinite alternate; }
.dsh-slot-widget-root .placed-collectible-drag-handle { position: absolute; z-index: 5; margin: 0; border: 1px solid transparent; padding: 0; background: transparent; cursor: grab; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .placed-collectible-drag-handle:hover { border-color: rgba(255,224,106,.68); background: rgba(255,224,106,.08); }
.dsh-slot-widget-root .placed-collectible-drag-handle:active { cursor: grabbing; }
@keyframes dsh-slot-magnet { from { filter: brightness(1); } to { filter: brightness(1.35); } }
.dsh-slot-widget-root .scene-control { position: absolute; z-index: 3; margin: 0; border: 0; padding: 0; color: transparent; background: transparent; cursor: pointer; touch-action: none; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .scene-control:disabled { cursor: not-allowed; }
.dsh-slot-widget-root .scene-control:focus-visible { border: 2px dashed #ffe37b; outline: 2px solid #081126; outline-offset: 1px; }
.dsh-slot-widget-root .scene-control--lever { top: 60px; left: 259px; width: 40px; height: 92px; }
.dsh-slot-widget-root .asset-warning { position: absolute; right: 16px; bottom: 8px; left: 16px; z-index: 5; margin: 0; border: 1px solid #df9842; padding: 4px 6px; color: #ffe6a6; background: rgba(8,18,37,.92); font-size: 10px; text-align: center; }
.dsh-slot-widget-root .utility-panel-slot { align-self: end; }
.dsh-slot-widget-root .utility-panel { width: 344px; max-height: 470px; overflow: auto; border: 2px solid #4d7780; padding: 10px; color: #e4ddc8; background: #0b1a32; box-shadow: 6px 6px 0 rgba(2,8,20,.62); font-size: 12px; }
.dsh-slot-widget-root .utility-panel__header { position: sticky; top: -10px; z-index: 2; display: flex; align-items: center; justify-content: space-between; margin: -10px -10px 8px; border-bottom: 2px solid #704f2e; padding: 8px 10px; background: #10223d; }
.dsh-slot-widget-root .utility-panel__header h2 { margin: 0; color: #ffd477; font-size: 14px; }
.dsh-slot-widget-root .panel-close { min-width: 28px; min-height: 26px; padding: 0; font-size: 17px; }
.dsh-slot-widget-root .set-progress,
.dsh-slot-widget-root .panel-wallet { margin: 7px 0; color: #8fd7cd; }
.dsh-slot-widget-root .collectible-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.dsh-slot-widget-root .collectible-row { display: grid; grid-template-columns: 48px minmax(0,1fr) auto; align-items: center; gap: 8px; min-height: 52px; border-bottom: 1px solid rgba(104,143,147,.28); }
.dsh-slot-widget-root .table-position-picker { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 5px; margin: 2px 0 8px; border: 1px solid #4d7780; padding: 7px; background: #07152a; }
.dsh-slot-widget-root .table-position-button { min-height: 30px; border: 1px solid #725735; padding: 3px; color: #f0dbaf; background: #162640; font-size: 10px; cursor: pointer; }
.dsh-slot-widget-root .table-position-button:hover:not(:disabled) { border-color: #f0b849; background: #263755; }
.dsh-slot-widget-root .table-position-button:disabled { opacity: .38; cursor: not-allowed; }
.dsh-slot-widget-root .collectible-sprite { display: block; width: 48px; height: 48px; image-rendering: pixelated; }
.dsh-slot-widget-root .collectible-sprite.is-locked { opacity: .32; filter: grayscale(1) brightness(.55); }
.dsh-slot-widget-root .collectible-row__copy { display: grid; gap: 3px; min-width: 0; }
.dsh-slot-widget-root .collectible-row__copy strong { overflow: hidden; color: #f7e4bd; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .collectible-row__copy small { color: #87a6a7; }
.dsh-slot-widget-root .collectible-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
.dsh-slot-widget-root .collectible-cell { position: relative; display: grid; justify-items: center; min-width: 0; border: 1px solid #385b68; padding: 3px 2px 4px; background: #09182e; cursor: grab; user-select: none; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .collectible-cell:hover:not(.is-locked) { border-color: #e6a63e; background: #142641; }
.dsh-slot-widget-root .collectible-cell.is-displayed { border-color: #55b9ae; box-shadow: inset 0 0 0 1px rgba(85,185,174,.25); }
.dsh-slot-widget-root .collectible-cell.is-locked { cursor: default; opacity: .58; }
.dsh-slot-widget-root .collectible-cell__copy { display: grid; width: 100%; gap: 1px; text-align: center; }
.dsh-slot-widget-root .collectible-cell__copy strong { overflow: hidden; color: #f7e4bd; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .collectible-cell__copy small { color: #7fc9bf; font-size: 8px; white-space: nowrap; }
.dsh-slot-widget-root .collectible-cell__return { position: absolute; top: 2px; right: 2px; border: 1px solid #7e9ba3; padding: 1px 2px; color: #ffe9bb; background: rgba(9,21,42,.9); font-size: 8px; cursor: pointer; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .setting-row { display: flex; align-items: center; gap: 9px; border-bottom: 1px solid rgba(104,143,147,.3); padding: 11px 3px; }
.dsh-slot-widget-root .setting-row input { width: 17px; height: 17px; accent-color: #d79a38; }
.dsh-slot-widget-root .scale-picker { display: flex; gap: 8px; margin: 14px 0 0; border: 1px solid #415f6c; padding: 10px; }
.dsh-slot-widget-root .scale-picker legend { padding: 0 5px; color: #8fd7cd; }
.dsh-slot-widget-root .visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
.dsh-slot-widget-root.desktop--overlay { position: absolute; right: 16px; bottom: 16px; width: var(--widget-width); min-height: 0; overflow: visible; padding: 0; background: transparent; filter: drop-shadow(0 9px 10px rgba(2,8,20,.5)); pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .desktop__ambient { display: none; }
.dsh-slot-widget-root.desktop--overlay .host-status { width: 100%; max-width: none; margin: 0 0 6px; border: 2px solid #6f5534; border-radius: 3px; padding: 5px 8px; background: rgba(6,17,38,.92); box-shadow: 3px 3px 0 rgba(2,8,20,.55); }
.dsh-slot-widget-root.desktop--overlay .host-status .reward-source-status { display: none; }
.dsh-slot-widget-root.desktop--overlay .token-energy-meter { flex-basis: 210px; }
.dsh-slot-widget-root.desktop--overlay .token-energy-meter__label { grid-template-columns: minmax(150px,auto) minmax(82px,1fr); }
.dsh-slot-widget-root.desktop--overlay .widget-launchers { justify-content: flex-end; margin: 0 0 6px; pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .widget-launchers .pixel-button { pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .plugin-game-layout { display: block; }
.dsh-slot-widget-root.desktop--overlay .slot-widget { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .game-canvas-wrap { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .slot-widget canvas { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .table-drop-hit-zone { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .utility-panel-slot { position: absolute; right: calc(100% + 12px); bottom: 0; }
.dsh-slot-widget-root.desktop--overlay .utility-panel { max-height: min(470px,calc(100vh - 32px)); pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .scene-control { pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .placed-collectible-drag-handle { pointer-events: auto; }
.dsh-slot-widget-root.desktop--companion { width: 100vw; height: 100vh; min-height: 0; overflow: hidden; padding: 0; color: #f7ddb0; background: transparent; }
.dsh-slot-widget-root.desktop--companion .companion-scale-surface { position: relative; width: 336px; height: var(--companion-base-height); overflow: hidden; padding: 5px 8px 7px; transform: scale(var(--companion-scale)); transform-origin: top left; filter: drop-shadow(0 8px 8px rgba(2,8,20,.58)); }
.dsh-slot-widget-root.desktop--companion .desktop__ambient { display: none; }
.dsh-slot-widget-root.desktop--companion .slot-widget-frame { cursor: move; -webkit-app-region: drag; }
.dsh-slot-widget-root.desktop--companion .game-canvas-wrap { -webkit-app-region: drag; cursor: move; }
.dsh-slot-widget-root.desktop--companion .slot-widget canvas { -webkit-app-region: drag; }
.dsh-slot-widget-root.desktop--companion .table-drop-hit-zone { -webkit-app-region: no-drag; }
.dsh-slot-widget-root.desktop--companion button,
.dsh-slot-widget-root.desktop--companion [draggable="true"] { -webkit-app-region: no-drag; }
.dsh-slot-widget-root.desktop--companion .host-status { width: 320px; min-height: 38px; margin: 3px 0; gap: 3px 8px; border: 1px solid #6f5534; padding: 3px 6px; font-size: 9px; }
.dsh-slot-widget-root.desktop--companion .wallet-status strong { font-size: 14px; }
.dsh-slot-widget-root.desktop--companion .token-energy-meter { flex-basis: 210px; gap: 1px; }
.dsh-slot-widget-root.desktop--companion .token-energy-meter__label { grid-template-columns: 112px 1fr; gap: 4px; }
.dsh-slot-widget-root.desktop--companion .token-energy-meter progress { height: 6px; }
.dsh-slot-widget-root.desktop--companion .reward-source-status,
.dsh-slot-widget-root.desktop--companion .connection-status { display: none; }
.dsh-slot-widget-root.desktop--companion.has-utility-panel .host-status { display: none; }
.dsh-slot-widget-root.desktop--companion .widget-launchers { height: 28px; margin: 3px 0; gap: 4px; }
.dsh-slot-widget-root.desktop--companion .widget-launchers .pixel-button { min-height: 24px; padding: 2px 7px; font-size: 9px; }
.dsh-slot-widget-root.desktop--companion .plugin-game-layout { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; }
.dsh-slot-widget-root.desktop--companion .slot-widget-frame { flex: 0 0 var(--widget-height); }
.dsh-slot-widget-root.desktop--companion .utility-panel-slot { order: -1; width: 320px; }
.dsh-slot-widget-root.desktop--companion .utility-panel { width: 320px; max-height: 160px; border-width: 1px; padding: 5px; box-shadow: 3px 3px 0 rgba(2,8,20,.58); font-size: 9px; }
.dsh-slot-widget-root.desktop--companion .utility-panel__header { top: -5px; margin: -5px -5px 3px; border-bottom-width: 1px; padding: 3px 5px; }
.dsh-slot-widget-root.desktop--companion .utility-panel__header h2 { font-size: 11px; }
.dsh-slot-widget-root.desktop--companion .panel-close { min-width: 22px; min-height: 20px; font-size: 13px; }
.dsh-slot-widget-root.desktop--companion .set-progress,
.dsh-slot-widget-root.desktop--companion .panel-wallet { margin: 2px 0 4px; font-size: 8px; }
.dsh-slot-widget-root.desktop--companion .collectible-grid { grid-template-columns: repeat(6,minmax(0,1fr)); gap: 3px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell { height: 54px; padding: 1px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell .collectible-sprite { width: 48px; height: 48px; transform: scale(.8); transform-origin: top center; margin-bottom: -10px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell__copy strong { font-size: 7px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell__copy small { display: none; }
.dsh-slot-widget-root.desktop--companion .edge-reveal-tab { display: none; }
.dsh-slot-widget-root.desktop--companion .companion-resize-grip { position: fixed; z-index: 40; width: 15px; height: 15px; pointer-events: none; opacity: .7; }
.dsh-slot-widget-root.desktop--companion .companion-resize-grip--top-left { top: 1px; left: 1px; border-top: 2px solid #80cfc8; border-left: 2px solid #80cfc8; }
.dsh-slot-widget-root.desktop--companion .companion-resize-grip--top-right { top: 1px; right: 1px; border-top: 2px solid #80cfc8; border-right: 2px solid #80cfc8; }
.dsh-slot-widget-root.desktop--companion .companion-resize-grip--bottom-left { bottom: 1px; left: 1px; border-bottom: 2px solid #80cfc8; border-left: 2px solid #80cfc8; }
.dsh-slot-widget-root.desktop--companion .companion-resize-grip--bottom-right { right: 1px; bottom: 1px; border-right: 2px solid #80cfc8; border-bottom: 2px solid #80cfc8; }
@media (max-width: 60px), (max-height: 60px) {
  .dsh-slot-widget-root.desktop--companion { width: 100vw; height: 100vh; padding: 0; background: transparent; filter: none; }
  .dsh-slot-widget-root.desktop--companion > :not(.edge-reveal-tab) { display: none !important; }
  .dsh-slot-widget-root.desktop--companion .edge-reveal-tab { position: fixed; inset: 0; z-index: 30; display: grid; width: 100vw; height: 100vh; min-width: 0; min-height: 0; place-items: center; border: 1px solid #89652f; padding: 0; color: #ffd867; background: rgba(7,20,40,.96); box-shadow: inset 0 0 0 1px rgba(83,211,197,.24); font-size: 13px; cursor: pointer; -webkit-app-region: no-drag; }
}
@media (max-width: 820px) {
  .dsh-slot-widget-root .plugin-game-layout { grid-template-columns: minmax(0,384px); }
  .dsh-slot-widget-root .utility-panel { width: min(344px,calc(100vw - 48px)); max-height: 42vh; }
  .dsh-slot-widget-root.desktop--overlay { right: 8px; bottom: 8px; }
  .dsh-slot-widget-root.desktop--overlay .utility-panel-slot { right: 0; bottom: calc(100% + 8px); }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-slot-widget-root *,
  .dsh-slot-widget-root *::before,
  .dsh-slot-widget-root *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
}
`;

export function installPluginStyle(target: Pick<Document, "createElement" | "head">): () => void {
  const style = target.createElement("style");
  style.dataset.dshSlotWidget = "";
  style.textContent = PLUGIN_STYLE;
  target.head.append(style);
  return () => style.remove();
}
