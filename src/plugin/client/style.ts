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
.dsh-slot-widget-root .plugin-game-layout { display: grid; grid-template-columns: minmax(0,384px) minmax(280px,344px); justify-content: center; align-items: end; gap: 12px; }
.dsh-slot-widget-root .slot-widget { width: 384px; height: 288px; transform: scale(var(--widget-scale)); transform-origin: top left; background: transparent; }
.dsh-slot-widget-root .slot-widget-frame { width: var(--widget-width); height: var(--widget-height); }
.dsh-slot-widget-root .slot-widget canvas { display: block; width: 384px; height: 288px; image-rendering: pixelated; }
.dsh-slot-widget-root .game-canvas-wrap { position: relative; width: 384px; height: 288px; }
.dsh-slot-widget-root .scene-control { position: absolute; z-index: 3; margin: 0; border: 0; padding: 0; color: transparent; background: transparent; cursor: pointer; touch-action: none; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .scene-control:disabled { cursor: not-allowed; }
.dsh-slot-widget-root .scene-control:focus-visible { border: 2px dashed #ffe37b; outline: 2px solid #081126; outline-offset: 1px; }
.dsh-slot-widget-root .scene-control--coin { top: 116px; left: 159px; width: 35px; height: 55px; }
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
.dsh-slot-widget-root .collectible-sprite { display: block; width: 48px; height: 48px; image-rendering: pixelated; }
.dsh-slot-widget-root .collectible-sprite.is-locked { opacity: .32; filter: grayscale(1) brightness(.55); }
.dsh-slot-widget-root .collectible-row__copy { display: grid; gap: 3px; min-width: 0; }
.dsh-slot-widget-root .collectible-row__copy strong { overflow: hidden; color: #f7e4bd; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .collectible-row__copy small { color: #87a6a7; }
.dsh-slot-widget-root .setting-row { display: flex; align-items: center; gap: 9px; border-bottom: 1px solid rgba(104,143,147,.3); padding: 11px 3px; }
.dsh-slot-widget-root .setting-row input { width: 17px; height: 17px; accent-color: #d79a38; }
.dsh-slot-widget-root .scale-picker { display: flex; gap: 8px; margin: 14px 0 0; border: 1px solid #415f6c; padding: 10px; }
.dsh-slot-widget-root .scale-picker legend { padding: 0 5px; color: #8fd7cd; }
.dsh-slot-widget-root .visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
@media (max-width: 820px) {
  .dsh-slot-widget-root .plugin-game-layout { grid-template-columns: minmax(0,384px); }
  .dsh-slot-widget-root .utility-panel { width: min(344px,calc(100vw - 48px)); max-height: 42vh; }
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
