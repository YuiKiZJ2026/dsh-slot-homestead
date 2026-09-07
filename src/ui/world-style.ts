export const WORLD_STYLE = `
.dsh-slot-widget-root .workbench-command-bar:has(.world-clock) { padding-left: 110px; }
.dsh-slot-widget-root .world-clock { position: absolute; top: 0; bottom: 0; left: 0; width: 110px; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 3px 7px; padding: 3px 5px; border: 0; border-right: 1px solid #516252; color: #f4d79d; background: #21392f; cursor: pointer; pointer-events: auto; -webkit-app-region: no-drag; font-variant-numeric: tabular-nums; }
.dsh-slot-widget-root .world-clock strong { font-size: 12px; }
.dsh-slot-widget-root .world-clock__day { font-size: 10px; }
.dsh-slot-widget-root .world-clock__visitor { width: 100%; font-size: 9px; line-height: 1; color: #f9da96; }
.dsh-slot-widget-root .world-clock[data-merchant-present=true] { background: #49513b; box-shadow: inset 0 -2px #d3b374; }
.dsh-slot-widget-root .world-clock:hover { background: #36503c; }
.dsh-slot-widget-root .merchant-panel { width: 364px; max-height: 476px; padding: 16px; font-size: 12px; overflow: auto; }
.dsh-slot-widget-root .merchant-summary { display: flex; gap: 15px; align-items: center; padding-bottom: 15px; }
.dsh-slot-widget-root .merchant-calendar-day { display: grid; grid-template-columns: 1fr auto; align-items: baseline; text-align: center; width: 64px; flex-shrink: 0; border: 1px solid #8c8258; color: #f6dca0; background: #293c30; padding: 6px; }
.dsh-slot-widget-root .merchant-calendar-day small { grid-column: span 2; font-size: 9px; padding-bottom: 4px; }
.dsh-slot-widget-root .merchant-calendar-day strong { font-size: 25px; line-height: 1.1; }
.dsh-slot-widget-root .merchant-calendar-day span { font-size: 10px; }
.dsh-slot-widget-root .merchant-summary__body > strong { font-size: 22px; font-variant-numeric: tabular-nums; color: #f1d59e; }
.dsh-slot-widget-root .merchant-summary__body strong span { font-size: 10px; font-weight: normal; color: #b6c4ac; }
.dsh-slot-widget-root .merchant-summary__body p { font-size: 10px; margin: 5px 0; }
.dsh-slot-widget-root .merchant-summary__body small { font-size: 9px; }
.dsh-slot-widget-root .merchant-visit { display: flex; align-items: center; gap: 10px; padding: 13px 0; border-bottom: 1px solid #3c5448; }
.dsh-slot-widget-root .merchant-visit__seal { color: #dcb578; font-size: 25px; width: 32px; text-align: center; }
.dsh-slot-widget-root .merchant-visit strong { font-size: 12px; }
.dsh-slot-widget-root .merchant-visit p { margin: 5px 0 0; color: #b9c6af; font-size: 10px; }
.dsh-slot-widget-root .merchant-visit[data-present=true] strong { color: #f6d394; }
.dsh-slot-widget-root .merchant-day-strip { display: flex; gap: 4px; padding: 14px 0 3px; }
.dsh-slot-widget-root .merchant-day-strip > div { flex: 1; padding: 7px 1px; text-align: center; background: #21372f; }
.dsh-slot-widget-root .merchant-day-strip span { display: block; font-size: 9px; color: #b9c6af; }
.dsh-slot-widget-root .merchant-day-strip strong { display: block; font-size: 11px; margin-top: 5px; }
.dsh-slot-widget-root .merchant-day-strip [data-arrival=true] { background: #4b5138; color: #ffe0a4; }
.dsh-slot-widget-root .merchant-day-strip [data-today=true] { box-shadow: inset 0 -2px #9fb982; }
.dsh-slot-widget-root .merchant-calendar-details p, .dsh-slot-widget-root .merchant-fineprint { color: #becbb7; font-size: 10px; line-height: 1.8; }
.dsh-slot-widget-root .merchant-rules { margin: 14px 0; }
.dsh-slot-widget-root .merchant-rules > div { display: grid; grid-template-columns: 66px 1fr; gap: 8px; padding: 8px 0; border-top: 1px solid #344c40; font-size: 10px; line-height: 1.7; }
.dsh-slot-widget-root .merchant-rules dt { color: #d4c193; }
.dsh-slot-widget-root .merchant-rules dd { margin: 0; color: #b9c6af; }
.dsh-slot-widget-root .merchant-panel .pixel-button { min-height: 30px; padding: 4px 9px; font-size: 11px; }
.dsh-slot-widget-root .merchant-panel .pixel-button:not(:disabled) { background: #426047; border-color: #a9ac76; color: #ffedc2; }
.dsh-slot-widget-root .merchant-panel .pixel-button:disabled { opacity: 1; background: #26372e; color: #b4bba6; border-color: #566650; box-shadow: none; }
.dsh-slot-widget-root .merchant-primary { width: 100%; }
.dsh-slot-widget-root .merchant-wallet { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; font-size: 11px; }
.dsh-slot-widget-root .merchant-wallet small { font-size: 9px; }
.dsh-slot-widget-root .merchant-offers { margin: 0; padding: 0; list-style: none; }
.dsh-slot-widget-root .merchant-offers li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid #3b5143; }
.dsh-slot-widget-root .merchant-offer__body { flex: 1; min-width: 0; }
.dsh-slot-widget-root .merchant-offer__body strong { display: block; font-size: 12px; }
.dsh-slot-widget-root .merchant-offer__body small { display: block; font-size: 10px; margin-top: 4px; }
.dsh-slot-widget-root .merchant-supply-mark { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #78825e; background: #34483a; color: #e2cc99; font-size: 17px; }
.dsh-slot-widget-root .merchant-sale { padding: 12px 0; border-top: 1px solid #4a5a46; }
.dsh-slot-widget-root .merchant-sale > strong { display: flex; justify-content: space-between; font-size: 12px; }
.dsh-slot-widget-root .merchant-sale p { font-size: 10px; line-height: 1.7; color: #c6d0bb; }
.dsh-slot-widget-root .merchant-sale small { display: block; font-size: 10px; margin: 7px 0; }
.dsh-slot-widget-root .merchant-sale__confirm { padding: 9px 0 0; color: #f3ce92; }
.dsh-slot-widget-root .merchant-sale__confirm > span { display: block; font-size: 10px; line-height: 1.8; margin-bottom: 8px; }
.dsh-slot-widget-root .merchant-cancel { border: 0; padding: 8px; background: transparent; color: #d3d5bd; cursor: pointer; font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .merchant-panel { width: 544px; max-height: 160px; padding: 9px 12px; display: grid; grid-template-columns: 110px 1fr; align-content: start; }
.dsh-slot-widget-root.desktop--companion .merchant-panel > * { grid-column: 1 / -1; }
.dsh-slot-widget-root.desktop--companion .merchant-summary { gap: 10px; padding-bottom: 7px; }
.dsh-slot-widget-root.desktop--companion .merchant-calendar-day { width: 45px; padding: 3px; }
.dsh-slot-widget-root.desktop--companion .merchant-calendar-day strong { font-size: 19px; }
.dsh-slot-widget-root.desktop--companion .merchant-summary__body > strong { font-size: 16px; }
.dsh-slot-widget-root.desktop--companion .merchant-offers { display: grid; grid-template-columns: 1fr 1fr; column-gap: 15px; }
.dsh-slot-widget-root.desktop--companion .merchant-sale { padding: 8px 0; }
.dsh-slot-widget-root.desktop--companion .merchant-panel:not([data-tab=calendar]) .merchant-summary { display: none; }
.dsh-slot-widget-root.desktop--companion .merchant-panel .utility-panel__header { grid-row: 1; margin: 0 0 5px; padding: 0 0 5px; top: -9px; }
.dsh-slot-widget-root.desktop--companion .merchant-panel .journal-tabs { grid-column: 2; grid-row: 1; position: sticky; top: -9px; z-index: 3; align-self: start; margin: 0 40px 5px 8px; background: #172627; }
.dsh-slot-widget-root.desktop--companion .merchant-panel .journal-tabs button { padding: 6px 2px; }
.dsh-slot-widget-root.desktop--companion .merchant-visit { padding: 4px 0; }
.dsh-slot-widget-root.desktop--companion .merchant-visit > div { display: flex; align-items: baseline; gap: 12px; }
.dsh-slot-widget-root.desktop--companion .merchant-visit strong { font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .merchant-visit p { margin: 0; font-size: 9px; }
.dsh-slot-widget-root.desktop--companion .merchant-visit__seal { display: none; }
.dsh-slot-widget-root.desktop--companion .merchant-wallet { padding: 5px 0; }
.dsh-slot-widget-root.desktop--companion .merchant-offers li { padding: 5px 0; gap: 7px; }
body:has(.merchant-panel) .preview-ecosystem-settlement { display: none; }
`;
