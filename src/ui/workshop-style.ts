/** Item browsing stays readable in both the desk's narrow drawer and the native companion. */
export const WORKSHOP_STYLE = `
.dsh-slot-widget-root .shop-panel .panel-wallet { margin: 0 0 9px; color: #ead6a6; font-variant-numeric: tabular-nums; }
.dsh-slot-widget-root .shop-tools { display: grid; gap: 9px; }
.dsh-slot-widget-root .shop-categories { display: flex; gap: 3px; border-bottom: 1px solid #4b6053; }
.dsh-slot-widget-root .shop-categories button { flex: 1; min-height: 30px; border: 0; border-bottom: 2px solid transparent; padding: 4px 8px; color: #bcc8ba; background: transparent; font: inherit; cursor: pointer; transition: background-color 160ms ease-out, color 160ms ease-out; }
.dsh-slot-widget-root .shop-categories button:hover { background: #283e34; color: #f3d69b; }
.dsh-slot-widget-root .shop-categories button[aria-pressed=true] { border-bottom-color: #e3ba70; color: #f3d69b; background: #293e34; }
.dsh-slot-widget-root .shop-search-field { position: relative; min-width: 0; }
.dsh-slot-widget-root .shop-panel .shop-search { margin: 0; }
.dsh-slot-widget-root .shop-panel .shop-search input { padding-right: 34px; font-size: 12px; }
.dsh-slot-widget-root .shop-panel .shop-search input::-webkit-search-cancel-button { display: none; }
.dsh-slot-widget-root .shop-search-clear { position: absolute; right: 2px; top: 2px; width: 29px; height: 29px; border: 0; background: transparent; color: #e9d8b5; font-size: 18px; cursor: pointer; }
.dsh-slot-widget-root .shop-search-clear:hover { background: #2f493b; }
.dsh-slot-widget-root .shop-result-count { margin: 9px 0 12px; color: #b9c9bb; font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.dsh-slot-widget-root .shop-empty { padding: 4px 0 20px; color: #c0cabc; font-size: 11px; line-height: 1.7; }
.dsh-slot-widget-root .shop-empty .pixel-button { margin-top: 6px; }
.dsh-slot-widget-root .shop-panel .workshop-section-title { margin: 13px 0 5px; color: #e7c580; font-size: 12px; }
.dsh-slot-widget-root .shop-reference-note { margin: 3px 0 7px; color: #aebfad; font-size: 10px; line-height: 1.65; }
.dsh-slot-widget-root .shop-panel .collectible-list { grid-template-columns: minmax(0, 1fr); gap: 0; }
.dsh-slot-widget-root .shop-panel .collectible-row { grid-template-columns: 48px minmax(0, 1fr) auto; gap: 9px; min-height: 61px; padding: 5px 0; border-bottom: 1px solid #364b3f; transition: background-color 160ms ease-out; }
.dsh-slot-widget-root .shop-panel .collectible-row:hover { background: #20372b; }
.dsh-slot-widget-root .shop-panel .item-portrait { background-color: #14251e; border-radius: 3px; }
.dsh-slot-widget-root .shop-panel .collectible-row strong { color: #f0dfb9; font-size: 12px; line-height: 1.5; }
.dsh-slot-widget-root .shop-panel .collectible-row small { color: #b6c5b5; font-size: 10px; line-height: 1.5; }
.dsh-slot-widget-root .shop-panel .collectible-row button { min-width: 60px; min-height: 30px; padding: 5px 6px; font-size: 10px; }
.dsh-slot-widget-root .shop-panel .collectible-row button:not(:disabled) { border-color: #a7b68a; color: #f6e4bb; background: #365940; }
.dsh-slot-widget-root .shop-panel .collectible-row button:not(:disabled):hover { background: #426a4c; }
.dsh-slot-widget-root .shop-panel .collectible-row button:disabled { opacity: 1; color: #a4b1a2; background: #21332a; border-color: #4c5e4d; box-shadow: none; cursor: default; }
.dsh-slot-widget-root .shop-panel .ecosystem-shop-row--supply { grid-template-columns: minmax(0, 1fr) auto; padding-left: 5px; }
.dsh-slot-widget-root .shop-panel .discovery-status { grid-column: auto; color: #a8bba7; font-size: 10px; }
.dsh-slot-widget-root .shop-panel .workshop-upgrade { border: 0; border-top: 1px solid #6a6547; background: transparent; margin: 15px 0 0; padding: 12px 0 5px; color: #b3c5b8; font-size: 10px; line-height: 1.6; }
.dsh-slot-widget-root .shop-panel .workshop-upgrade strong { color: #e7c580; }
.dsh-slot-widget-root.desktop--companion .shop-panel { max-height: 160px; }
.dsh-slot-widget-root.desktop--companion .shop-panel .panel-wallet { margin-bottom: 5px; font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .shop-tools { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.dsh-slot-widget-root.desktop--companion .shop-panel .shop-search input { min-height: 28px; font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .shop-categories button { min-height: 28px; padding: 3px 6px; font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .shop-search-clear { width: 25px; height: 24px; }
.dsh-slot-widget-root.desktop--companion .shop-panel .collectible-list { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 15px; }
.dsh-slot-widget-root.desktop--companion .shop-panel .collectible-row { gap: 5px; min-height: 55px; }
.dsh-slot-widget-root.desktop--companion .shop-panel .collectible-row strong { font-size: 11px; }
.dsh-slot-widget-root.desktop--companion .shop-panel .collectible-row button { min-width: 52px; padding: 4px; }
.dsh-slot-widget-root.desktop--companion .shop-result-count { margin: 5px 0; }
.dsh-slot-widget-root .shop-panel .collectible-row .shop-portrait-toggle { position: relative; width: 48px; min-width: 48px; min-height: 48px; padding: 0; border: 0; border-radius: 3px; background: transparent; box-shadow: none; cursor: pointer; }
.dsh-slot-widget-root .shop-panel .shop-portrait-toggle .item-portrait { box-sizing: border-box; border: 1px solid #4c6650; }
.dsh-slot-widget-root .shop-panel .collectible-row .shop-portrait-toggle:hover { background: transparent; }
.dsh-slot-widget-root .shop-panel .shop-portrait-toggle:hover .item-portrait, .dsh-slot-widget-root .shop-panel .shop-portrait-toggle[aria-expanded=true] .item-portrait { border-color: #dcc080; }
.dsh-slot-widget-root .shop-portrait-toggle__hint { position: absolute; bottom: 1px; right: 1px; padding: 1px 3px; background: #102419ed; color: #dfd4ae; font-size: 8px; line-height: 1.2; }
.dsh-slot-widget-root .shop-growth-reference { position: relative; grid-column: 1 / -1; min-width: 0; padding: 8px; background: #10231c; outline: none; }
.dsh-slot-widget-root .shop-growth-reference:focus-visible { outline: 2px solid #d8c084; outline-offset: -2px; }
.dsh-slot-widget-root .shop-growth-reference__preview { display: flex; align-items: center; gap: 10px; padding-right: 22px; }
.dsh-slot-widget-root .shop-growth-reference__preview > div { min-width: 0; }
.dsh-slot-widget-root .shop-panel .shop-growth-reference__preview strong { display: block; overflow-wrap: anywhere; font-size: 11px; }
.dsh-slot-widget-root .shop-growth-reference__preview p { margin: 6px 0 0; color: #b5c5b4; font-size: 10px; line-height: 1.6; }
.dsh-slot-widget-root .shop-panel .collectible-row .shop-growth-reference__close { position: absolute; right: 3px; top: 3px; min-width: 24px; min-height: 24px; padding: 0; border: 0; color: #dfd4ae; background: transparent; font-size: 17px; cursor: pointer; }
.dsh-slot-widget-root .shop-growth-reference__stages { display: flex; gap: 4px; margin-top: 6px; }
.dsh-slot-widget-root .shop-panel .shop-growth-reference__stages button { flex: 1; min-width: 0; min-height: 27px; padding: 4px; border: 1px solid #3e5a44; border-radius: 2px; background: #1c3325; color: #bbccb7; font: inherit; font-size: 10px; cursor: pointer; }
.dsh-slot-widget-root .shop-panel .shop-growth-reference__stages button[aria-pressed=true] { background: #365c3d; border-color: #bfc68a; color: #fae6b0; }
.dsh-slot-widget-root.desktop--companion .shop-panel .collectible-row[data-reference-open=true] { grid-column: 1 / -1; }
.dsh-slot-widget-root.desktop--companion .shop-growth-reference { padding: 5px 8px; }
.dsh-slot-widget-root.desktop--companion .shop-growth-reference__preview p { max-width: 32ch; }
@media (prefers-reduced-motion: reduce) { .dsh-slot-widget-root .shop-categories button, .dsh-slot-widget-root .shop-panel .collectible-row { transition: none; } }
`;
