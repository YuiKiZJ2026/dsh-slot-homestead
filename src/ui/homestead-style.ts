/** Shared by the embedded DSH client, native companion and local preview. */
export const HOMESTEAD_STYLE = `
.dsh-slot-widget-root { --homestead-ink: #eaddc4; --homestead-muted: #b5b6a4; --homestead-accent: #e4b561; --homestead-panel: #172b2b; }
.dsh-slot-widget-root button, .dsh-slot-widget-root select { font-family: inherit; }
.dsh-slot-widget-root button:focus-visible, .dsh-slot-widget-root select:focus-visible { outline: 2px solid #f4d488; outline-offset: 3px; }
.dsh-slot-widget-root .pixel-button { border-radius: 3px; transition: background-color 140ms, border-color 140ms; }
.dsh-slot-widget-root .utility-panel { border: 1px solid #86704b; color: var(--homestead-ink); background: #172627; box-shadow: 3px 4px 0 #0005, inset 0 0 0 3px #233635; scrollbar-color: #77866b #172627; scrollbar-width: thin; animation: homestead-panel-enter 180ms cubic-bezier(.22,1,.36,1); }
.dsh-slot-widget-root .utility-panel__header { border-bottom: 1px solid #536056; padding-bottom: 10px; margin-bottom: 12px; background: #172627; }
.dsh-slot-widget-root .utility-panel__header h2 { font-size: 17px; letter-spacing: .06em; color: #f3d69b; }
.dsh-slot-widget-root .utility-panel small { color: #b4c3b9; }
.dsh-slot-widget-root .panel-close { min-width: 28px; min-height: 28px; }
.dsh-slot-widget-root .homestead-journal { width: 364px; max-height: 476px; padding: 16px; font-size: 12px; scrollbar-color: #667467 #172627; scrollbar-width: thin; }
.dsh-slot-widget-root .journal-rank { display: flex; align-items: center; gap: 12px; padding: 2px 0 14px; }
.dsh-slot-widget-root .journal-rank__seal { display: grid; place-items: center; width: 36px; height: 40px; color: #172627; background: #e3ba70; font-size: 22px; font-weight: 700; clip-path: polygon(15% 0,85% 0,100% 15%,100% 78%,50% 100%,0 78%,0 15%); }
.dsh-slot-widget-root .journal-rank > div { flex: 1; }
.dsh-slot-widget-root .journal-rank strong { display: block; font-size: 15px; }
.dsh-slot-widget-root .journal-rank small { display: block; margin: 4px 0; font-size: 10px; }
.dsh-slot-widget-root .journal-date { align-self: start; color: #c2ba9f; font-size: 11px; }
.dsh-slot-widget-root .journal-tabs { display: flex; gap: 3px; border-bottom: 1px solid #647062; }
.dsh-slot-widget-root .journal-tabs button { flex: 1; border: 0; border-bottom: 2px solid transparent; padding: 9px 2px; color: #b9c2b5; background: transparent; cursor: pointer; font-size: 12px; }
.dsh-slot-widget-root .journal-tabs button[aria-pressed=true] { color: #f3d69b; border-bottom-color: #e3ba70; background: #213735; }
.dsh-slot-widget-root .journal-note { margin: 12px 0; color: #b5c0b4; line-height: 1.8; font-size: 11px; }
.dsh-slot-widget-root .journal-quests { list-style: none; padding: 0; margin: 0; }
.dsh-slot-widget-root .journal-quest { display: flex; align-items: center; gap: 12px; padding: 15px 0; border-bottom: 1px solid #344b44; }
.dsh-slot-widget-root .journal-quest__body { flex: 1; min-width: 0; }
.dsh-slot-widget-root .journal-quest strong { font-size: 13px; font-weight: 600; }
.dsh-slot-widget-root .journal-quest p { display: flex; justify-content: space-between; gap: 8px; margin: 6px 0; font-size: 10px; color: #b5c0b4; line-height: 1.6; }
.dsh-slot-widget-root .journal-quest p span { white-space: nowrap; font-variant-numeric: tabular-nums; }
.dsh-slot-widget-root .journal-quest small { display: block; margin-top: 7px; font-size: 10px; line-height: 1.7; color: #d3bc89; }
.dsh-slot-widget-root .journal-quest button { min-width: 66px; min-height: 32px; font-size: 10px; padding: 5px; }
.dsh-slot-widget-root .journal-quest button:not(:disabled) { background: #3f6550; color: #ffebbb; border-color: #aec188; }
.dsh-slot-widget-root .journal-quest button:disabled { opacity: 1; border-color: #44594f; color: #91a595; background: #20342f; box-shadow: none; cursor: default; }
.dsh-slot-widget-root .journal-quest[data-complete=true] strong { color: #9ec5a7; }
.dsh-slot-widget-root .homestead-journal progress { appearance: none; width: 100%; height: 4px; border: 0; background: #34453e; display: block; }
.dsh-slot-widget-root .homestead-journal progress::-webkit-progress-bar { background: #34453e; }
.dsh-slot-widget-root .homestead-journal progress::-webkit-progress-value { background: #a6c797; }
.dsh-slot-widget-root .homestead-journal progress::-moz-progress-bar { background: #a6c797; }
.dsh-slot-widget-root .journal-footer { padding-top: 14px; color: #97ad9f; font-size: 10px; text-align: center; }
.dsh-slot-widget-root .journal-supply { display: flex; justify-content: space-between; padding-bottom: 12px; color: #d4c294; }
.dsh-slot-widget-root .journal-plots { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.dsh-slot-widget-root .journal-plot { min-width: 0; padding: 10px; border: 1px solid #48574a; background: #21332c; }
.dsh-slot-widget-root .journal-plot__heading { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; }
.dsh-slot-widget-root .journal-plot__heading span { font-size: 9px; color: #b3ac8b; }
.dsh-slot-widget-root .journal-plot strong { font-size: 12px; }
.dsh-slot-widget-root .journal-plot small { display: block; font-size: 9px; margin: 7px 0; }
.dsh-slot-widget-root .journal-plot__actions { display: flex; gap: 4px; }
.dsh-slot-widget-root .journal-plot select { width: 100%; min-width: 0; color: #eee0bf; background: #122721; border: 1px solid #647362; font-size: 10px; }
.dsh-slot-widget-root .journal-plot button { min-width: 38px; min-height: 27px; padding: 2px; font-size: 10px; }
.dsh-slot-widget-root .journal-error { color: #ffd0b8; font-size: 11px; }
.dsh-slot-widget-root .journal-plot__identity { display: flex; align-items: center; gap: 7px; min-height: 45px; margin-bottom: 6px; }
.dsh-slot-widget-root .journal-plot__identity .journal-plot__heading { margin-bottom: 0; }
.dsh-slot-widget-root .journal-plot__empty { display: grid; place-items: center; width: 40px; height: 40px; border: 1px dashed #82916f; color: #b0b99f; font-size: 17px; }
.dsh-slot-widget-root .journal-plot[data-ripe=true] { border-color: #bdba78; background: #30432c; }
.dsh-slot-widget-root .journal-plot progress::-webkit-progress-value { transition: width 200ms cubic-bezier(.22,1,.36,1); }
.dsh-slot-widget-root .journal-garden-tools { display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px; }
.dsh-slot-widget-root .journal-garden-tools .journal-supply { padding: 0; gap: 8px; align-items: center; font-size: 11px; }
.dsh-slot-widget-root .journal-harvest { min-height: 30px; padding: 4px 9px; font-size: 11px; }
.dsh-slot-widget-root .journal-harvest:not(:disabled) { border-color: #c8bf7d; background: #426444; color: #ffedbe; }
.dsh-slot-widget-root .journal-cancel-plan { width: 100%; margin-top: 8px; min-height: 26px; padding: 3px 0; border: 0; border-top: 1px solid #5b6b51; background: transparent; color: #e7d4a7; font-size: 10px; cursor: pointer; }
.dsh-slot-widget-root .journal-cancel-plan:disabled { cursor: wait; color: #b3bbaa; }
.dsh-slot-widget-root .journal-quest[data-complete=true] { animation: homestead-quest-confirm 240ms ease-out; }
.dsh-slot-widget-root .pixel-button:not(:disabled):active { filter: brightness(1.15); }
.dsh-slot-widget-root .homestead-feedback-region { position: fixed; right: 28px; bottom: 8px; z-index: 22; pointer-events: none; max-width: min(430px, calc(100vw - 56px)); }
.dsh-slot-widget-root .homestead-feedback { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border: 1px solid #9b9465; background: #182d25; color: #f3e1b6; box-shadow: 2px 3px 0 #0007; animation: homestead-feedback-enter 220ms cubic-bezier(.22,1,.36,1); }
.dsh-slot-widget-root .homestead-feedback__mark { display: grid; place-items: center; width: 22px; height: 22px; color: #d4e0b0; border: 1px solid #85946c; font-size: 13px; }
.dsh-slot-widget-root .homestead-feedback strong { display: block; font-size: 12px; line-height: 1.6; }
.dsh-slot-widget-root .homestead-feedback small { display: block; color: #bccdb4; font-size: 10px; line-height: 1.5; }
.dsh-slot-widget-root.desktop--companion .homestead-feedback-region { position: absolute; right: 12px; bottom: 6px; max-width: calc(100% - 24px); }
.dsh-slot-widget-root.desktop--companion .homestead-feedback { padding: 5px 9px; }
.dsh-slot-widget-root.desktop--companion .homestead-feedback strong { font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .homestead-feedback small { font-size: 9px; }
.dsh-slot-widget-root[data-reduced-motion=true] .utility-panel, .dsh-slot-widget-root[data-reduced-motion=true] .journal-quest, .dsh-slot-widget-root[data-reduced-motion=true] .homestead-feedback { animation: none; }
.dsh-slot-widget-root[data-reduced-motion=true] .pixel-button, .dsh-slot-widget-root[data-reduced-motion=true] .journal-plot progress::-webkit-progress-value { transition: none; }
.dsh-slot-widget-root[data-reduced-motion=true] .shop-categories button, .dsh-slot-widget-root[data-reduced-motion=true] .collectible-row, .dsh-slot-widget-root[data-reduced-motion=true] .shop-portrait-trigger { transition: none; }
@keyframes homestead-panel-enter { from { opacity: .75; } to { opacity: 1; } }
@keyframes homestead-feedback-enter { from { opacity: .7; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@keyframes homestead-quest-confirm { from { background-color: #39573c; } to { background-color: transparent; } }
.dsh-slot-widget-root .shop-search { display: block; margin: 12px 0 16px; }
.dsh-slot-widget-root .shop-search input { width: 100%; min-height: 34px; padding: 6px 10px; border: 1px solid #617565; border-radius: 3px; background: #0e211d; color: #eadfc5; font: inherit; }
.dsh-slot-widget-root .shop-search input::placeholder { color: #9aaa9b; }
.dsh-slot-widget-root .shop-search input:focus-visible { outline: 2px solid #dfc38b; outline-offset: 2px; }
.dsh-slot-widget-root .journal-desk-book { position: absolute; top: -33px; left: 302px; z-index: 7; display: flex; align-items: center; justify-content: center; gap: 0; width: 93px; height: 28px; border: 1px solid #796342; padding: 0 6px; background: #21322b; color: #f4dba8; cursor: pointer; pointer-events: auto; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .journal-desk-book .collectible-sprite { flex: 0 0 48px; margin: -10px; transform: scale(.52); filter: drop-shadow(0 2px 1px #0008); }
.dsh-slot-widget-root .journal-desk-book__label { font-size: 9px; text-shadow: 1px 1px #130b06; white-space: nowrap; }
.dsh-slot-widget-root .journal-desk-book__badge { position: absolute; top: 0; right: 1px; display: grid; place-items: center; min-width: 14px; height: 14px; background: #e9bf70; color: #2a291c; font-size: 9px; border: 1px solid #5a4425; border-radius: 50%; }
.dsh-slot-widget-root .journal-desk-book:hover .collectible-sprite { filter: brightness(1.25) drop-shadow(0 2px 1px #0008); }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer { width: 288px; left: 24px; top: 176px; height: auto; min-height: 92px; padding: 10px; display: grid; grid-template-columns: 1fr; gap: 8px; background: #172c28f5; border-color: #8d784d; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer > * + * { border-left: 0; padding-left: 0; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__status { display: grid; grid-template-columns: 1fr auto; gap: 5px; font-size: 11px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__status small { grid-column: 1 / -1; font-size: 9px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__status progress { grid-column: 1 / -1; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__interaction-notice { flex: 1; min-width: 130px; font-size: 9px; line-height: 1.6; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer-close { width: 24px; height: 24px; top: -24px; right: 0; background: #172c28; font-size: 15px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-harmony { display: none; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer-handle { height: 23px; top: 208px; font-size: 9px; background: #25392c; color: #f3d69b; }
.dsh-slot-widget-root .ecosystem-scene__eta { color: #bdd3bd; }
.dsh-slot-widget-root .ecosystem-scene__plant-plan { font-size: 9px; min-height: 26px; }
.dsh-slot-widget-root .workbench-command-bar { position: relative; padding-right: 102px; }
.dsh-slot-widget-root .workbench-command-bar .journal-desk-book { top: 50%; left: auto; right: 5px; transform: translateY(-50%); }
.dsh-slot-widget-root .workbench-command-bar .current-goal { display: grid; grid-template-columns: minmax(0,1fr); gap: 2px; padding: 2px 8px; background: transparent; }
.dsh-slot-widget-root .workbench-command-bar .current-goal strong { font-size: 11px; }
.dsh-slot-widget-root .workbench-command-bar .current-goal__eyebrow { display: none; }
.dsh-slot-widget-root .workbench-command-bar .current-goal > span { font-size: 9px; }
.dsh-slot-widget-root .workbench-command-bar .current-goal progress { display: none; }
.dsh-slot-widget-root .ecosystem-scene__switcher { background: #142822; }
.dsh-slot-widget-root.desktop--page .host-status { border: 1px solid #405447; padding: 12px 16px; color: #c8cfbd; background: #152825e6; border-radius: 4px; }
.dsh-slot-widget-root.desktop--page .reward-source-status { display: none; }
.dsh-slot-widget-root.desktop--companion .homestead-journal { width: 544px; max-height: 184px; font-size: 12px; }
.dsh-slot-widget-root.desktop--companion .journal-rank { display: none; }
.dsh-slot-widget-root.desktop--companion .journal-plots { grid-template-columns: repeat(3, 1fr); }
.dsh-slot-widget-root.desktop--companion .journal-desk-book { pointer-events: auto; -webkit-app-region: no-drag; }
@media (max-width: 1000px) {
  .dsh-slot-widget-root.desktop--page:not(.desktop--companion) .utility-panel-slot { right: var(--edge-right, 12px); bottom: calc(var(--edge-bottom, 12px) + var(--widget-height) + var(--control-deck-height) + 8px); }
  .dsh-slot-widget-root.desktop--page:not(.desktop--companion) .utility-panel { width: min(364px, calc(100vw - 24px)); max-width: calc(100vw - 24px); max-height: min(440px, 42vh); }
}
@media (prefers-reduced-motion: reduce) { .dsh-slot-widget-root .pixel-button, .dsh-slot-widget-root .journal-plot progress::-webkit-progress-value { transition: none; } .dsh-slot-widget-root .utility-panel, .dsh-slot-widget-root .journal-quest, .dsh-slot-widget-root .homestead-feedback { animation: none; } }
`;
