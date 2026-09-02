export const PLUGIN_STYLE = `
.dsh-slot-widget-root,
.dsh-slot-widget-root *,
.dsh-slot-widget-root *::before,
.dsh-slot-widget-root *::after { box-sizing: border-box; }
.dsh-slot-widget-root { --widget-scale: 1; --widget-width: 641px; --widget-height: 277px; --ease-out: cubic-bezier(.23,1,.32,1); --ease-in-out: cubic-bezier(.77,0,.175,1); --daylight-ambient-color: rgba(82,176,192,.08); --daylight-ambient-opacity: .24; --daylight-scene-filter: brightness(1.06) saturate(1.04) contrast(1.02); position: relative; isolation: isolate; min-height: 640px; overflow: auto; padding: 18px; color: #f7ddb0; background: radial-gradient(circle at 74% 28%, rgba(31,74,103,.28), transparent 31%), linear-gradient(145deg,#07142c,#091b32 54%,#050d1d); font-family: "SFMono-Regular", "Cascadia Mono", "Noto Sans Mono CJK SC", monospace; font-synthesis: none; }
.dsh-slot-widget-root[data-day-phase="dawn"] { --daylight-ambient-color: rgba(192,111,58,.2); --daylight-ambient-opacity: .34; --daylight-scene-filter: brightness(.88) saturate(.94) sepia(.09) contrast(1.04); }
.dsh-slot-widget-root[data-day-phase="day"] { --daylight-ambient-color: rgba(82,176,192,.08); --daylight-ambient-opacity: .24; --daylight-scene-filter: brightness(1.06) saturate(1.04) contrast(1.02); }
.dsh-slot-widget-root[data-day-phase="dusk"] { --daylight-ambient-color: rgba(175,71,43,.3); --daylight-ambient-opacity: .46; --daylight-scene-filter: brightness(.74) saturate(.96) sepia(.18) contrast(1.08); }
.dsh-slot-widget-root[data-day-phase="night"] { --daylight-ambient-color: rgba(0,4,16,.76); --daylight-ambient-opacity: .82; --daylight-scene-filter: brightness(.52) saturate(.7) contrast(1.14); }
.dsh-slot-widget-root .desktop__ambient { position: absolute; inset: 0; z-index: -1; opacity: var(--daylight-ambient-opacity); background-color: var(--daylight-ambient-color); background-image: linear-gradient(rgba(92,151,167,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(92,151,167,.04) 1px,transparent 1px); background-size: 24px 24px; transition: opacity 900ms var(--ease-in-out),background-color 900ms var(--ease-in-out); }
.dsh-slot-widget-root.desktop--starry .desktop__ambient { opacity: var(--daylight-ambient-opacity); background-image: radial-gradient(circle,rgba(255,222,124,.8) 0 1px,transparent 1px),radial-gradient(circle,rgba(79,211,202,.65) 0 1px,transparent 1px); background-size: 73px 67px,97px 89px; }
.dsh-slot-widget-root .desktop__night-sky { position: absolute; top: -116px; left: -132px; z-index: 2; width: 128px; height: 112px; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 240ms var(--ease-out),visibility 0s linear 240ms; }
.dsh-slot-widget-root[data-day-phase="night"] .desktop__night-sky { opacity: .94; visibility: visible; transition-delay: 0s; }
.dsh-slot-widget-root .ecosystem-widget [data-night-moonlight] { position: absolute; top: -4px; left: -10px; z-index: 2; display: block; width: 344px; height: 226px; opacity: 0; pointer-events: none; background: radial-gradient(ellipse 112% 90% at 0 0,rgba(126,192,225,.14) 0%,rgba(72,132,181,.07) 42%,transparent 74%); filter: blur(6px); mix-blend-mode: screen; transition: opacity 240ms var(--ease-out); }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-widget [data-night-moonlight] { opacity: .48; }
.dsh-slot-widget-root .desktop__pixel-moon { position: absolute; top: 8px; left: 55px; display: block; width: 63px; height: 63px; filter: drop-shadow(0 0 1px rgba(255,210,91,.28)); image-rendering: pixelated; }
.dsh-slot-widget-root .desktop__pixel-star { position: absolute; width: 2px; height: 2px; background: #fff0a8; box-shadow: 0 -3px #fff0a8,0 3px #fff0a8,-3px 0 #fff0a8,3px 0 #fff0a8; animation: dsh-night-star-twinkle 3.2s steps(2,end) infinite; }
.dsh-slot-widget-root .desktop__pixel-star--medium { width: 3px; height: 3px; color: #7bd9d1; background: currentColor; box-shadow: 0 -4px currentColor,0 4px currentColor,-4px 0 currentColor,4px 0 currentColor; }
.dsh-slot-widget-root .desktop__pixel-star--large { width: 4px; height: 4px; background: #ffe08a; box-shadow: 0 -5px #ffe08a,0 5px #ffe08a,-5px 0 #ffe08a,5px 0 #ffe08a; }
.dsh-slot-widget-root .daylight-status { position: fixed; bottom: 18px; left: 18px; z-index: 5; display: flex; align-items: center; gap: 6px; margin: 0; border-left: 2px solid #70cfc4; padding: 4px 7px; color: #9bbab9; background: rgba(6,17,38,.82); font-size: 9px; pointer-events: none; }
.dsh-slot-widget-root .daylight-status strong { color: #ffe08a; font-size: 10px; }
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
.dsh-slot-widget-root .pixel-button { min-height: 30px; border: 2px solid #7e9ba3; border-radius: 2px; padding: 5px 9px; color: #f9e5bc; background: #142641; box-shadow: inset 0 -2px #09152a,inset 0 2px rgba(117,218,205,.12); cursor: pointer; transition: transform 140ms var(--ease-out); }
.dsh-slot-widget-root .pixel-button:hover:not(:disabled),
.dsh-slot-widget-root .pixel-button[aria-pressed="true"],
.dsh-slot-widget-root .pixel-button[aria-expanded="true"] { border-color: #e6a63e; color: #fff2c6; background: #263453; }
.dsh-slot-widget-root .pixel-button:active:not(:disabled) { transform: scale(.97); }
.dsh-slot-widget-root .pixel-button:disabled { cursor: not-allowed; opacity: .48; }
.dsh-slot-widget-root .pixel-button--compact { min-width: 58px; min-height: 26px; padding: 3px 6px; font-size: 11px; }
.dsh-slot-widget-root .widget-launchers { display: grid; width: 132px; min-width: 132px; height: 30px; grid-template-columns: repeat(3,minmax(0,1fr)); align-items: center; gap: 0; border: 1px solid #6f5534; background: #08182d; box-shadow: 2px 2px 0 rgba(2,8,20,.58),inset 0 0 0 1px rgba(84,211,198,.08); }
.dsh-slot-widget-root .widget-launchers .pixel-button { width: 100%; min-width: 0; height: 100%; min-height: 0; border: 0; border-left: 1px solid rgba(107,151,158,.38); border-radius: 0; padding: 0 3px; color: #d9d6b8; background: linear-gradient(180deg,rgba(25,48,76,.78),rgba(11,27,51,.9)); box-shadow: inset 0 -2px rgba(3,12,27,.72); font-size: 10px; }
.dsh-slot-widget-root .widget-launchers .pixel-button:hover:not(:disabled),
.dsh-slot-widget-root .widget-launchers .pixel-button[aria-expanded="true"] { border-color: rgba(230,166,62,.58); color: #fff2c6; background: linear-gradient(180deg,#263b58,#172943); box-shadow: inset 0 -3px #e6a63e; }
.dsh-slot-widget-root .current-goal { display: grid; min-width: 0; height: 100%; grid-template-columns: 52px 114px minmax(0,1fr) 86px; align-items: center; gap: 0 8px; border: 0; padding: 4px 8px; color: #a9c2c2; background: radial-gradient(circle at 17% 50%,rgba(84,211,198,.055),transparent 34%); font-size: 9px; }
.dsh-slot-widget-root .current-goal__eyebrow { border-left: 2px solid #54d3c6; padding-left: 6px; color: #6ed8ca; white-space: nowrap; }
.dsh-slot-widget-root .current-goal strong { color: #ffe08a; font-size: 10px; white-space: nowrap; }
.dsh-slot-widget-root .current-goal > span:not(.current-goal__eyebrow) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .current-goal progress { width: 100%; height: 4px; border: 0; background: #071226; accent-color: #54d3c6; }
.dsh-slot-widget-root .current-goal progress::-webkit-progress-bar { background: #071226; box-shadow: inset 0 0 0 1px #294a55; }
.dsh-slot-widget-root .current-goal progress::-webkit-progress-value { background: #54d3c6; }
.dsh-slot-widget-root .current-goal progress::-moz-progress-bar { background: #54d3c6; }
.dsh-slot-widget-root .workbench-command-bar { display: grid; height: 100%; grid-template-columns: minmax(0,1fr); align-items: stretch; gap: 0; border: 0; padding: 0; background: rgba(8,23,44,.82); box-shadow: none; }
.dsh-slot-widget-root .plugin-content-surface { display: contents; }
.dsh-slot-widget-root .plugin-game-layout { display: grid; grid-template-columns: minmax(0,var(--widget-width)) minmax(280px,344px); justify-content: center; align-items: end; gap: 12px; }
.dsh-slot-widget-root .ecosystem-widget { position: relative; display: block; width: 704px; height: 304px; transform: scale(var(--widget-scale)) scale(.91); transform-origin: top left; background: transparent; filter: drop-shadow(0 8px 5px rgba(2,8,20,.52)); }
.dsh-slot-widget-root .slot-widget { position: absolute; top: 0; left: 320px; z-index: 3; width: 384px; height: 288px; background: transparent; }
.dsh-slot-widget-root .slot-widget-frame { width: var(--widget-width); height: calc(var(--widget-height) + var(--control-deck-height)); padding-top: var(--control-deck-height); }
.dsh-slot-widget-root .slot-widget canvas { display: block; width: 384px; height: 288px; filter: var(--daylight-scene-filter); image-rendering: pixelated; transition: filter 900ms var(--ease-in-out); }
.dsh-slot-widget-root[data-day-phase="night"] .slot-widget canvas { filter: brightness(.82) saturate(.90) sepia(.08) contrast(1.08); }
.dsh-slot-widget-root .game-canvas-wrap { position: relative; width: 384px; height: 288px; }
.dsh-slot-widget-root .slot-night-lighting { position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: screen; }
.dsh-slot-widget-root [data-slot-night-light] { position: absolute; display: block; opacity: 0; pointer-events: none; transition: opacity 240ms var(--ease-out); }
.dsh-slot-widget-root[data-day-phase="night"] .slot-night-light--marquee { opacity: .96; }
.dsh-slot-widget-root[data-day-phase="night"] .slot-night-light--reels { opacity: .88; }
.dsh-slot-widget-root[data-day-phase="night"] .slot-night-light--control-panel { opacity: .88; }
.dsh-slot-widget-root .slot-night-light--cabinet { top: 3px; left: 150px; z-index: 0; width: 128px; height: 173px; border:0; clip-path: inset(0 round 34px 34px 10px 10px / 26px 26px 10px 10px); background: radial-gradient(ellipse 72px 42px at 64px 30px,rgba(255,166,45,.26),rgba(214,93,24,.10) 50%,transparent 78%),radial-gradient(ellipse 24px 94px at 22px 98px,rgba(235,117,27,.19),transparent 82%),radial-gradient(ellipse 24px 94px at 106px 98px,rgba(235,117,27,.19),transparent 82%),radial-gradient(ellipse 86px 30px at 64px 154px,rgba(255,142,30,.17),transparent 84%); box-shadow:none; }
.dsh-slot-widget-root[data-day-phase="night"] .slot-night-light--cabinet { opacity: .94; }
.dsh-slot-widget-root .slot-night-light--marquee { top: 0; left: 0; z-index: 1; width: 384px; height: 72px; background: radial-gradient(circle 26px at 212px 34px,rgba(255,199,75,.20),transparent 72%); }
.dsh-slot-widget-root .slot-night-light--reels { top: 61px; left: 168px; z-index: 1; width: 88px; height: 60px; border:0; clip-path: inset(0 round 3px); background: radial-gradient(ellipse 74% 34% at 50% 10%,rgba(105,207,221,.18),transparent 74%),linear-gradient(180deg,rgba(48,137,159,.08),transparent 44%,rgba(20,77,101,.04)); box-shadow:none; }
.dsh-slot-widget-root .slot-night-light--control-panel { top: 127px; left: 182px; z-index: 1; width: 64px; height: 34px; border:0; clip-path: inset(0 round 3px); background: radial-gradient(ellipse 78% 58% at 50% 32%,rgba(255,187,65,.18),rgba(221,111,29,.07) 55%,transparent 82%); box-shadow:none; }
.dsh-slot-widget-root [data-slot-star] { position: absolute; top: 24px; left: 202px; display: block; width: 21px; height: 21px; pointer-events: none; filter: drop-shadow(0 0 4px rgba(255,190,60,.52)); image-rendering: pixelated; }
.dsh-slot-widget-root [data-slot-bulb] { position: absolute; top: 52px; display: block; width: 5px; height: 5px; pointer-events: none; background: #ffd66b; box-shadow: 0 0 3px rgba(255,190,59,.52); }
.dsh-slot-widget-root [data-slot-bulb="1"] { left: 176px; }
.dsh-slot-widget-root [data-slot-bulb="2"] { left: 190px; background: #e46f32; animation-delay: -.4s; }
.dsh-slot-widget-root [data-slot-bulb="3"] { left: 204px; animation-delay: -.8s; }
.dsh-slot-widget-root [data-slot-bulb="4"] { left: 218px; background: #e46f32; animation-delay: -1.2s; }
.dsh-slot-widget-root [data-slot-bulb="5"] { left: 232px; animation-delay: -1.6s; }
.dsh-slot-widget-root [data-slot-bulb="6"] { left: 246px; background: #e46f32; animation-delay: -2s; }
.dsh-slot-widget-root[data-day-phase="night"] [data-slot-bulb] { animation: dsh-slot-bulb-chase 2.4s steps(3,end) infinite; }
.dsh-slot-widget-root .ecosystem-scene { position: absolute; inset: 0; z-index: 1; display: block; width: 704px; height: 304px; padding: 0; color: #f7ddb0; background: transparent; }
.dsh-slot-widget-root .ecosystem-scene__command-deck { position: absolute; right: 0; bottom: calc(100% + 2px); z-index: 6; display: grid; width: 704px; height: 42px; grid-template-columns: minmax(0,1fr) 196px; gap: 0; border: 1px solid #6f5534; padding: 3px; background: linear-gradient(180deg,rgba(12,31,57,.98),rgba(6,19,38,.98)); box-shadow: 3px 3px 0 rgba(2,8,20,.42),inset 0 0 0 1px rgba(83,211,197,.08); }
.dsh-slot-widget-root .ecosystem-scene__command-deck > .ecosystem-scene__switcher { min-width: 0; height: 100%; border-left: 1px solid rgba(107,151,158,.32); padding-inline: 5px; background: rgba(7,20,40,.58); }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer { position: absolute; top: 216px; left: 40px; z-index: 6; display: grid; width: 276px; height: 70px; grid-template-columns: 90px minmax(0,1fr) 52px; align-items: stretch; gap: 5px; border: 1px solid #6f5534; padding: 7px 16px 7px 7px; color: #f7ddb0; background: linear-gradient(180deg,rgba(14,35,58,.97),rgba(6,19,36,.99)); box-shadow: 3px 3px 0 rgba(2,8,20,.55),inset 0 0 0 1px rgba(84,211,198,.08); animation: dsh-context-drawer-open 150ms steps(3,end) both; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer > * + * { border-left: 1px solid rgba(107,151,158,.25); padding-left: 5px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__actions { grid-template-columns: 52px 52px minmax(0,1fr); gap: 5px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__actions:not(:has(.ecosystem-scene__collect)) { grid-template-columns: 52px minmax(0,1fr); }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__care { min-height: 26px; padding-inline: 3px; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__collect { min-width: 0; min-height: 26px; padding-inline: 3px; border-color: #4e9d94; color: #d8fff7; background: linear-gradient(180deg,#1d4850,#122d3a); }
.dsh-slot-widget-root .ecosystem-scene__produce { color: #76d8c9; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer .ecosystem-scene__interaction-notice { white-space: normal; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer-close { position: absolute; top: 2px; right: 2px; display: grid; width: 12px; height: 12px; place-items: center; border: 0; padding: 0; color: #987a50; background: transparent; font-size: 11px; line-height: 1; cursor: pointer; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer-close:hover { color: #ffe08a; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer-handle { position: absolute; top: 204px; left: 268px; z-index: 6; width: 44px; height: 18px; border: 1px solid #6f5534; padding: 0 3px; color: #d8b875; background: linear-gradient(180deg,#17304b,#091b31); box-shadow: inset 0 -2px rgba(2,8,20,.52); font-size: 8px; cursor: pointer; }
.dsh-slot-widget-root .ecosystem-scene__habitat-drawer-handle:hover { border-color: #e6a63e; color: #fff2c6; }
.dsh-slot-widget-root .slot-tool-console { position: absolute; top: 127px; left: 181px; z-index: 8; width: 64px; height: 34px; }
.dsh-slot-widget-root .slot-tool-console__trigger { width: 64px; height: 34px; border: 0; padding: 6px 5px 2px; color: #d6ac5d; background: radial-gradient(ellipse at 50% 26%,rgba(255,194,69,.11),transparent 66%); font-size: 8px; letter-spacing: 2px; text-shadow: 1px 1px #32180b; cursor: pointer; }
.dsh-slot-widget-root .slot-tool-console__trigger:hover,
.dsh-slot-widget-root .slot-tool-console__trigger[aria-expanded="true"] { color: #ffe08a; }
.dsh-slot-widget-root .slot-tool-console .widget-launchers { position: absolute; top: 35px; left: -34px; animation: dsh-context-drawer-open 150ms steps(3,end) both; }
.dsh-slot-widget-root .ecosystem-scene__art { position: absolute; inset: 0; z-index: 1; display: block; overflow: visible; filter: var(--daylight-scene-filter); transition: filter 900ms var(--ease-in-out); }
.dsh-slot-widget-root .ecosystem-scene__habitat-layer,
.dsh-slot-widget-root .ecosystem-scene__habitat-prop { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; object-position: right bottom; image-rendering: pixelated; }
.dsh-slot-widget-root .ecosystem-scene__table-base { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; object-fit: contain; object-position: right bottom; image-rendering: pixelated; }
.dsh-slot-widget-root .ecosystem-scene__equipment-base { position: absolute; inset: 0; z-index: 3; display: block; width: 100%; height: 100%; object-fit: contain; object-position: right bottom; pointer-events: none; image-rendering: pixelated; }
.dsh-slot-widget-root .ecosystem-scene__habitat-bay { position: absolute; top: 8px; left: 32px; z-index: 2; width: 292px; height: 210px; overflow: hidden; }
.dsh-slot-widget-root .ecosystem-scene__habitat-stage { position: absolute; z-index: 1; animation: dsh-habitat-enter-next 180ms var(--ease-out) both; will-change: transform,opacity; }
.dsh-slot-widget-root .ecosystem-scene__habitat-stage[data-transition-direction="previous"] { animation-name: dsh-habitat-enter-previous; }
.dsh-slot-widget-root .ecosystem-scene__habitat-stage[data-transition-direction="next"] { animation-name: dsh-habitat-enter-next; }
.dsh-slot-widget-root .ecosystem-scene__habitat-layer,
.dsh-slot-widget-root .ecosystem-scene__habitat-prop { z-index: 2; }
.dsh-slot-widget-root .ecosystem-scene__habitat-layer { cursor: pointer; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-layer { position: absolute; top: 8px; left: 32px; z-index: 2; width: 292px; height: 210px; overflow: hidden; pointer-events: none; animation: dsh-habitat-enter-next 180ms var(--ease-out) both; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-layer[data-transition-direction="previous"] { animation-name: dsh-habitat-enter-previous; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-prop { position: absolute; z-index: 3; display: block; object-fit: contain; pointer-events: none; image-rendering: pixelated; filter: url("#dsh-night-prop-alpha-cutout"); transition: filter 900ms var(--ease-in-out); }
.dsh-slot-widget-root .ecosystem-scene__alpha-filter { position: absolute; width: 0; height: 0; overflow: hidden; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-prop--aquarium-lamp { top: 4px; left: 220px; width: 56px; height: 58px; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-prop--garden-lamp { top: 65px; left: 232px; width: 54px; height: 78px; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-prop--scarecrow { top: 42px; left: 128px; width: 62px; height: 93px; }
.dsh-slot-widget-root .ecosystem-scene__atmosphere-prop--pasture-lamp { top: 84px; left: 216px; width: 72px; height: 108px; transform: scaleX(-1); transform-origin: 50% 50%; }
.dsh-slot-widget-root .ecosystem-scene__night-glow { position: absolute; z-index: 1; display: block; opacity: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity 240ms var(--ease-out); }
.dsh-slot-widget-root .ecosystem-scene__night-glow--aquarium { top: 24px; left: 34px; width: 268px; height: 176px; background: radial-gradient(ellipse at 78% 16%,rgba(95,205,228,.34),rgba(47,147,183,.18) 46%,transparent 84%); }
.dsh-slot-widget-root .ecosystem-scene__night-glow--garden { top: 54px; left: 40px; width: 252px; height: 150px; border-radius: 50%; background: radial-gradient(ellipse at 76% 42%,rgba(242,174,68,.38),rgba(214,125,36,.20) 54%,transparent 88%); filter: blur(4px); }
.dsh-slot-widget-root .ecosystem-scene__night-glow--animals { top: 70px; left: 34px; width: 258px; height: 136px; border-radius: 50%; background: radial-gradient(ellipse at 72% 48%,rgba(244,168,65,.30),rgba(210,118,31,.14) 52%,transparent 86%); filter: blur(4px); }
.dsh-slot-widget-root .ecosystem-scene__night-hotspot { position: absolute; z-index: 2; display: block; border-radius: 50%; opacity: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity 240ms var(--ease-out); }
.dsh-slot-widget-root [data-night-hotspot],
.dsh-slot-widget-root [data-night-rest] { pointer-events: none; }
.dsh-slot-widget-root .ecosystem-scene__night-hotspot--aquarium { top: 20px; left: 240px; width: 32px; height: 38px; background: radial-gradient(ellipse at 50% 18%,rgba(255,211,106,.72),rgba(255,169,58,.28) 36%,rgba(107,195,215,.1) 58%,transparent 76%); }
.dsh-slot-widget-root .ecosystem-scene__night-hotspot--garden { top: 72px; left: 244px; width: 30px; height: 34px; background: radial-gradient(ellipse at 50% 28%,rgba(255,211,106,.72),rgba(255,164,48,.26) 38%,transparent 76%); }
.dsh-slot-widget-root .ecosystem-scene__night-hotspot--animals { top: 104px; left: 222px; width: 34px; height: 38px; background: radial-gradient(ellipse at 48% 26%,rgba(255,211,106,.72),rgba(255,161,45,.27) 38%,transparent 76%); }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow { opacity: .74; }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow--aquarium { opacity: .88; }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow--garden { opacity: .88; }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-hotspot { opacity: .82; animation: dsh-night-lamp-flicker 4.8s steps(4,end) infinite; }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__atmosphere-prop:not(.ecosystem-scene__atmosphere-prop--scarecrow) { filter: url("#dsh-night-prop-alpha-cutout") brightness(1.03) saturate(1.08) drop-shadow(0 0 3px rgba(255,184,64,.45)); }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__atmosphere-prop--scarecrow { filter: url("#dsh-night-prop-alpha-cutout") brightness(.88) saturate(.9) contrast(1.08); }
.dsh-slot-widget-root:not([data-day-phase="night"]) .ecosystem-scene__atmosphere-prop:not(.ecosystem-scene__atmosphere-prop--scarecrow) { filter: url("#dsh-night-prop-alpha-cutout") brightness(.78) saturate(.62) contrast(1.08); }
.dsh-slot-widget-root .ecosystem-scene__animal-rest { position: absolute; top: 35%; left: 27%; z-index: 5; width: 14%; height: 24%; opacity: .96; pointer-events: none; filter: brightness(2.15) saturate(1.18); }
.dsh-slot-widget-root .ecosystem-scene__coop-warmth { position: absolute; top: 34%; left: 12%; width: 62%; height: 45%; background: radial-gradient(ellipse,rgba(255,211,99,.74),rgba(236,130,28,.32) 45%,transparent 76%); clip-path: polygon(20% 0,80% 0,100% 24%,100% 100%,0 100%,0 24%); mix-blend-mode: screen; }
.dsh-slot-widget-root .ecosystem-scene__sleep-mark { position: absolute; color: #ffe08a; font-weight: 800; font-size: 10px; line-height: 1; text-shadow: 2px 0 #7c4a25; image-rendering: pixelated; animation: dsh-sleep-mark-drift 2.8s steps(4,end) infinite; }
.dsh-slot-widget-root .ecosystem-scene__sleep-mark--near { top: 20%; left: 52%; }
.dsh-slot-widget-root .ecosystem-scene__sleep-mark--far { top: -4%; left: 76%; font-size: 7px; animation-delay: -1.3s; }
.dsh-slot-widget-root .ecosystem-motion-layer { position: absolute; z-index: 3; display: block; height: auto; pointer-events: none; image-rendering: pixelated; will-change: transform,opacity; }
.dsh-slot-widget-root .ecosystem-motion-layer--plant-left { left: 19%; bottom: 35%; width: 9%; transform-origin: 50% 100%; animation: dsh-plant-sway 3.4s cubic-bezier(.77,0,.175,1) -1.1s infinite alternate; }
.dsh-slot-widget-root .ecosystem-motion-layer--plant-right { left: 50%; bottom: 35%; width: 9%; transform-origin: 50% 100%; animation: dsh-plant-sway 4.1s cubic-bezier(.77,0,.175,1) -.4s infinite alternate-reverse; }
.dsh-slot-widget-root .ecosystem-motion-layer--bubbles-slow { left: 34%; bottom: 43%; width: 4%; animation: dsh-bubbles-rise 4.8s linear -2.2s infinite; }
.dsh-slot-widget-root .ecosystem-motion-layer--bubbles-fast { left: 55%; bottom: 41%; width: 4%; animation: dsh-bubbles-rise 3.6s linear -.8s infinite; }
.dsh-slot-widget-root .ecosystem-motion-layer--fish-gold { top: 35%; left: 19%; width: 17%; animation: dsh-fish-swim-a 8.8s linear -.9s infinite; }
.dsh-slot-widget-root .ecosystem-motion-layer--fish-pearl { top: 45%; left: 20%; width: 17%; animation: dsh-fish-swim-b 10.4s linear -4.7s infinite; }
.dsh-slot-widget-root .ecosystem-motion-layer--fish-stripe { top: 55%; left: 19%; width: 17%; animation: dsh-fish-swim-a 12.2s linear -7.2s infinite; }
.dsh-slot-widget-root .ecosystem-plot-cell { position: absolute; z-index: 3; display: block; width: 18%; height: 18%; border: 1px solid transparent; padding: 0; background: transparent; cursor: pointer; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .ecosystem-plot-cell--1 { top: 28%; left: 28%; }
.dsh-slot-widget-root .ecosystem-plot-cell--2 { top: 28%; left: 50%; }
.dsh-slot-widget-root .ecosystem-plot-cell--3 { top: 28%; left: 72%; }
.dsh-slot-widget-root .ecosystem-plot-cell--4 { top: 48%; left: 28%; }
.dsh-slot-widget-root .ecosystem-plot-cell--5 { top: 48%; left: 50%; }
.dsh-slot-widget-root .ecosystem-plot-cell--6 { top: 48%; left: 72%; }
.dsh-slot-widget-root .ecosystem-plot-cell .ecosystem-motion-layer { top: auto; bottom: 24%; left: 50%; margin: 0; translate: -50% 0; transform-origin: 50% 100%; }
.dsh-slot-widget-root .ecosystem-plot-cell:focus-visible,
.dsh-slot-widget-root .ecosystem-plot-cell.is-selected { border-color: rgba(255,215,104,.72); background: rgba(255,210,92,.08); box-shadow: inset 0 0 0 1px rgba(72,39,15,.6); }
.dsh-slot-widget-root .ecosystem-motion-layer--crop-carrot { width: 82%; animation: dsh-crop-grow 3.2s cubic-bezier(.77,0,.175,1) -.7s infinite alternate; }
.dsh-slot-widget-root .ecosystem-motion-layer--crop-tomato { width: 95%; animation: dsh-crop-grow 3.8s cubic-bezier(.77,0,.175,1) -1.8s infinite alternate-reverse; }
.dsh-slot-widget-root .ecosystem-motion-layer--crop-cabbage { width: 95%; animation: dsh-crop-grow 4.2s cubic-bezier(.77,0,.175,1) -.2s infinite alternate; }
.dsh-slot-widget-root .ecosystem-motion-layer--crop-leafy { width: 95%; animation: dsh-crop-grow 3.6s cubic-bezier(.77,0,.175,1) -1.2s infinite alternate-reverse; }
.dsh-slot-widget-root .ecosystem-motion-layer--crop-pumpkin { width: 105%; animation: dsh-crop-grow 4.4s cubic-bezier(.77,0,.175,1) -2.4s infinite alternate; }
.dsh-slot-widget-root .ecosystem-motion-layer--crop-onion { width: 88%; animation: dsh-crop-grow 3.4s cubic-bezier(.77,0,.175,1) -.5s infinite alternate-reverse; }
.dsh-slot-widget-root .ecosystem-motion-layer--animal-chick { top: 51%; left: 49%; width: 10%; transform-origin: 50% 100%; animation: dsh-chick-ecosystem 15.6s steps(48,end) -2.1s infinite; }
.dsh-slot-widget-root .ecosystem-motion-layer--animal-rabbit { top: 50%; left: 58%; width: 13%; transform-origin: 50% 100%; animation: dsh-rabbit-ecosystem 18.4s linear -7.3s infinite; }
.dsh-slot-widget-root .ecosystem-motion-layer--animal-alpaca { top: 42%; left: 57%; width: 15%; transform-origin: 50% 100%; animation: dsh-alpaca-ecosystem 22.8s steps(60,end) -11.6s infinite; }
.dsh-slot-widget-root .ecosystem-resident-interaction { margin: 0; border: 0; padding: 0; background: transparent; pointer-events: auto; cursor: pointer; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .ecosystem-resident-feedback-frame { display: block; transform-origin: 50% 100%; transition: transform 140ms var(--ease-out); will-change: transform,opacity; }
.dsh-slot-widget-root .ecosystem-scene--aquarium .ecosystem-resident-feedback-frame { transform-origin: 50% 50%; }
.dsh-slot-widget-root .ecosystem-resident-sprite { display: block; width: 100%; background-color: transparent; image-rendering: pixelated; transform-origin: 50% 100%; animation: dsh-life-stage-arrive 240ms steps(4,end) both; }
.dsh-slot-widget-root [data-visual-stage="fry"] .ecosystem-resident-sprite,
.dsh-slot-widget-root [data-visual-stage="baby"] .ecosystem-resident-sprite,
.dsh-slot-widget-root [data-visual-stage="seedling"] .ecosystem-resident-sprite { filter: saturate(.9) brightness(.98); }
.dsh-slot-widget-root [data-visual-stage="adult"] .ecosystem-resident-sprite { filter: saturate(1.05) brightness(1.02); }
.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene--aquarium [data-motion="swim"] .ecosystem-resident-sprite { filter: brightness(1.55) saturate(1.5) contrast(1.08) drop-shadow(0 0 2px rgba(126,220,229,.34)); }
.dsh-slot-widget-root [data-visual-stage="harvest-ready"] .ecosystem-resident-sprite { filter: brightness(1.08) drop-shadow(0 0 2px rgba(255,224,106,.56)); animation: dsh-life-stage-arrive 240ms steps(4,end) both,dsh-produce-ready 2.4s steps(4,end) 240ms 2; }
.dsh-slot-widget-root .ecosystem-animal-companion { position: absolute; right: -82%; bottom: -4%; z-index: 2; display: block; width: 84%; pointer-events: none; filter: drop-shadow(1px 2px 0 rgba(38,22,12,.46)); }
.dsh-slot-widget-root .ecosystem-scene__ground-produce-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.dsh-slot-widget-root .ecosystem-scene__ground-produce { position: absolute; display: block; width: 9%; margin: 0; border: 0; padding: 0; background: transparent; color: #fff0b6; cursor: pointer; pointer-events: auto; filter: drop-shadow(1px 2px 0 rgba(45,24,12,.62)); transform-origin: 50% 100%; animation: dsh-ground-produce-arrive 360ms steps(6,end) both; }
.dsh-slot-widget-root .ecosystem-scene__ground-produce:hover,
.dsh-slot-widget-root .ecosystem-scene__ground-produce:focus-visible { outline: 1px solid #ffe072; outline-offset: 2px; filter: brightness(1.18) drop-shadow(0 0 4px rgba(255,215,96,.78)); }
.dsh-slot-widget-root .ecosystem-scene__ground-produce--egg { left: 42%; bottom: 21%; width: 7%; filter: brightness(1.08) drop-shadow(0 0 2px rgba(255,239,177,.82)) drop-shadow(1px 2px 0 rgba(45,24,12,.72)); }
.dsh-slot-widget-root .ecosystem-scene__ground-produce--rabbit-kit { left: 57%; bottom: 20%; width: 10%; }
.dsh-slot-widget-root .ecosystem-scene__ground-produce--alpaca-cria { left: 69%; bottom: 21%; width: 12%; }
.dsh-slot-widget-root .ecosystem-scene__ground-produce-sprite { display: block; width: 100%; image-rendering: pixelated; }
.dsh-slot-widget-root .ecosystem-scene__ground-produce-count { position: absolute; right: -8px; bottom: -3px; min-width: 12px; border: 1px solid #74431d; padding: 0 2px; background: rgba(7,20,38,.92); color: #ffe072; font: 7px/11px monospace; text-align: center; }
.dsh-slot-widget-root .ecosystem-resident-interaction:focus-visible,
.dsh-slot-widget-root .ecosystem-resident-interaction.is-reacting,
.dsh-slot-widget-root .ecosystem-plot-cell.is-reacting { filter: brightness(1.35) drop-shadow(0 0 4px rgba(255,218,105,.9)); }
.dsh-slot-widget-root .ecosystem-resident-interaction:active .ecosystem-resident-feedback-frame,
.dsh-slot-widget-root .ecosystem-plot-cell:active .ecosystem-resident-feedback-frame { transform: scale(.97); }
.dsh-slot-widget-root .ecosystem-scene--aquarium .ecosystem-resident-interaction.is-reacting .ecosystem-resident-feedback-frame { animation: dsh-fish-react 620ms steps(6,end) both; }
.dsh-slot-widget-root .ecosystem-plot-cell.is-reacting .ecosystem-resident-feedback-frame { animation: dsh-crop-react 720ms steps(7,end) both; }
.dsh-slot-widget-root .ecosystem-scene--animals .ecosystem-resident-interaction.is-reacting .ecosystem-resident-feedback-frame { animation: dsh-animal-react 760ms steps(8,end) both; }
.dsh-slot-widget-root .ecosystem-scene__reaction { position: absolute; z-index: 5; display: flex; max-width: 164px; align-items: center; gap: 5px; border: 2px solid #d99a38; padding: 3px 6px 3px 4px; color: #fff0bd; background: rgba(7,20,40,.94); box-shadow: 3px 3px 0 rgba(2,8,20,.58),inset 0 0 0 1px rgba(101,215,202,.2); font-size: 8px; line-height: 1.25; pointer-events: none; animation: dsh-reaction-pop 1700ms var(--ease-out) both; will-change: transform,opacity; }
.dsh-slot-widget-root .ecosystem-scene__reaction--fish { top: 24%; left: 43%; }
.dsh-slot-widget-root .ecosystem-scene__reaction--crop { top: 19%; left: 18%; }
.dsh-slot-widget-root .ecosystem-scene__reaction--animal { top: 31%; left: 39%; }
.dsh-slot-widget-root .ecosystem-scene__reaction-effect { display: block; flex: 0 0 44px; width: 44px; height: 44px; object-fit: contain; image-rendering: pixelated; animation: dsh-reaction-effect 820ms steps(6,end) both; will-change: transform,opacity; }
.dsh-slot-widget-root .ecosystem-scene__care-feedback { position: absolute; z-index: 4; width: 18px; height: 18px; pointer-events: none; animation: dsh-care-feedback 520ms var(--ease-out) both; }
.dsh-slot-widget-root .ecosystem-scene__care-feedback::before { position: absolute; inset: 0; border: 2px solid #ffe072; background: transparent; box-shadow: 0 0 0 2px rgba(84,211,198,.92),0 0 0 4px rgba(255,224,114,.34); content: ""; animation: dsh-care-feedback-pixel 520ms steps(5,end) both; }
.dsh-slot-widget-root .ecosystem-scene__care-feedback[data-care-habitat="aquarium"] { top: 46%; left: 51%; }
.dsh-slot-widget-root .ecosystem-scene__care-feedback[data-care-habitat="garden"] { top: 48%; left: 52%; }
.dsh-slot-widget-root .ecosystem-scene__care-feedback[data-care-habitat="animals"] { top: 55%; left: 52%; }
@media (hover: hover) and (pointer: fine) {
  .dsh-slot-widget-root .ecosystem-plot-cell:hover { border-color: rgba(255,215,104,.72); background: rgba(255,210,92,.08); box-shadow: inset 0 0 0 1px rgba(72,39,15,.6); }
  .dsh-slot-widget-root .ecosystem-resident-interaction:hover { filter: brightness(1.35) drop-shadow(0 0 4px rgba(255,218,105,.9)); }
}
@keyframes dsh-habitat-enter-previous { from { transform: translate3d(-8px,0,0); } to { transform: translate3d(0,0,0); } }
@keyframes dsh-habitat-enter-next { from { transform: translate3d(8px,0,0); } to { transform: translate3d(0,0,0); } }
@keyframes dsh-life-stage-arrive { 0% { opacity: .34; transform: translate3d(0,3px,0) scale(.88); } 55% { opacity: 1; transform: translate3d(0,-2px,0) scale(1.06); } 100% { opacity: 1; transform: translate3d(0,0,0) scale(1); } }
@keyframes dsh-ground-produce-arrive { 0% { opacity: 0; transform: translate3d(0,-8px,0) scale(.68); } 48% { opacity: 1; transform: translate3d(0,2px,0) scale(1.08,.92); } 72% { transform: translate3d(0,-2px,0) scale(.96,1.05); } 100% { opacity: 1; transform: translate3d(0,0,0) scale(1); } }
@keyframes dsh-produce-ready { 0%,100% { filter: brightness(1.04) drop-shadow(0 0 2px rgba(255,224,106,.45)); } 50% { filter: brightness(1.2) drop-shadow(0 0 4px rgba(255,224,106,.82)); } }
@keyframes dsh-context-drawer-open { from { opacity: 0; transform: translate3d(0,-3px,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
@keyframes dsh-habitat-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dsh-night-star-twinkle { 0%,100% { opacity: .36; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }
@keyframes dsh-night-lamp-flicker { 0%,100% { opacity: .82; } 48% { opacity: .9; } 52% { opacity: .78; } 58% { opacity: .86; } }
@keyframes dsh-sleep-mark-drift { 0%,100% { opacity: .42; transform: translate3d(0,2px,0); } 50% { opacity: 1; transform: translate3d(1px,-2px,0); } }
@keyframes dsh-slot-bulb-chase { 0%,100% { opacity: .58; } 34% { opacity: 1; } 67% { opacity: .76; } }
@keyframes dsh-reaction-pop { 0% { opacity: 0; transform: translate3d(0,4px,0) scale(.94); } 11% { opacity: 1; transform: translate3d(0,0,0) scale(1); } 82% { opacity: 1; transform: translate3d(0,0,0) scale(1); } 100% { opacity: 0; transform: translate3d(0,-2px,0) scale(.97); } }
@keyframes dsh-reaction-effect { 0% { opacity: 0; transform: translate3d(0,4px,0) scale(.9); } 24% { opacity: 1; transform: translate3d(0,-2px,0) scale(1.08); } 64% { opacity: 1; transform: translate3d(0,0,0) scale(1); } 100% { opacity: .72; transform: translate3d(0,-3px,0) scale(.98); } }
@keyframes dsh-care-feedback { 0% { opacity: 0; transform: translate3d(-50%,-50%,0) scale(.45); } 20% { opacity: 1; transform: translate3d(-50%,-50%,0) scale(.7); } 60% { opacity: .92; transform: translate3d(-50%,-50%,0) scale(1.05); } 100% { opacity: 0; transform: translate3d(-50%,-50%,0) scale(1.45); } }
@keyframes dsh-care-feedback-pixel { from { opacity: .72; transform: scale(.82); } to { opacity: 1; transform: scale(1); } }
@keyframes dsh-care-feedback-confirm { 0%,100% { opacity: 0; } 35%,65% { opacity: 1; } }
@keyframes dsh-fish-react { 0%,100% { opacity: 1; transform: translate3d(0,0,0) rotate(0) scale(1); } 18% { transform: translate3d(7px,-2px,0) rotate(-5deg) scale(1.06,.96); } 36% { transform: translate3d(2px,1px,0) rotate(4deg) scale(.98,1.03); } 54% { transform: translate3d(8px,-1px,0) rotate(-3deg) scale(1.04,.98); } 72% { transform: translate3d(3px,1px,0) rotate(2deg) scale(.99,1.02); } }
@keyframes dsh-crop-react { 0%,100% { opacity: 1; transform: translate3d(0,0,0) rotate(0) scale(1); } 18% { transform: translate3d(0,-5px,0) rotate(-6deg) scale(1.03,.97); } 36% { transform: translate3d(0,-2px,0) rotate(5deg) scale(.98,1.04); } 54% { transform: translate3d(0,-4px,0) rotate(-3deg) scale(1.02,.99); } 72% { transform: translate3d(0,-1px,0) rotate(2deg) scale(.99,1.02); } }
@keyframes dsh-animal-react { 0%,100% { opacity: 1; transform: translate3d(0,0,0) rotate(0) scale(1); } 16% { transform: translate3d(0,-8px,0) rotate(-3deg) scale(1.02,.98); } 32% { transform: translate3d(2px,0,0) rotate(2deg) scale(.98,1.03); } 48% { transform: translate3d(3px,3px,0) rotate(10deg) scale(1.02,.96); } 64% { transform: translate3d(1px,0,0) rotate(-3deg) scale(.99,1.02); } 80% { transform: translate3d(0,2px,0) rotate(7deg) scale(1.01,.98); } }
@keyframes dsh-fish-swim-a { 0% { transform: translate3d(92px,0,0) scaleX(-1); } 49.99% { transform: translate3d(0,5px,0) scaleX(-1); } 50% { transform: translate3d(0,5px,0) scaleX(1); } 99.99% { transform: translate3d(92px,0,0) scaleX(1); } 100% { transform: translate3d(92px,0,0) scaleX(-1); } }
@keyframes dsh-fish-swim-b { 0% { transform: translate3d(84px,0,0) scaleX(-1); } 49.99% { transform: translate3d(0,-5px,0) scaleX(-1); } 50% { transform: translate3d(0,-5px,0) scaleX(1); } 99.99% { transform: translate3d(84px,0,0) scaleX(1); } 100% { transform: translate3d(84px,0,0) scaleX(-1); } }
@keyframes dsh-plant-sway { from { transform: rotate(-2deg) scaleX(.98); } to { transform: rotate(2deg) scaleX(1.02); } }
@keyframes dsh-bubbles-rise { 0% { opacity: 0; transform: translate3d(0,18px,0); } 18% { opacity: .9; } 82% { opacity: .75; } 100% { opacity: 0; transform: translate3d(4px,-52px,0); } }
@keyframes dsh-crop-grow { from { transform: translate3d(0,1px,0) rotate(-1deg) scale(.985); transform-origin: 50% 100%; } to { transform: translate3d(0,-1px,0) rotate(1deg) scale(1.02); transform-origin: 50% 100%; } }
@keyframes dsh-chick-ecosystem { 0%,6% { transform: translate3d(0,0,0) scaleX(1) rotate(0); } 8%,11% { transform: translate3d(-2px,4px,0) scaleX(1) rotate(-11deg); } 13% { transform: translate3d(0,0,0) scaleX(1) rotate(0); } 18% { transform: translate3d(-18px,-2px,0) scaleX(1) rotate(-2deg); } 23% { transform: translate3d(-38px,0,0) scaleX(1) rotate(0); } 27%,34% { transform: translate3d(-38px,0,0) scaleX(1) rotate(0); } 34.99% { transform: translate3d(-38px,0,0) scaleX(1) rotate(0); } 35% { transform: translate3d(-38px,0,0) scaleX(-1) rotate(0); } 43% { transform: translate3d(-10px,0,0) scaleX(-1) rotate(0); } 50% { transform: translate3d(24px,-2px,0) scaleX(-1) rotate(2deg); } 57% { transform: translate3d(58px,0,0) scaleX(-1) rotate(0); } 61%,66% { transform: translate3d(58px,4px,0) scaleX(-1) rotate(10deg); } 69%,76% { transform: translate3d(58px,0,0) scaleX(-1) rotate(0); } 76.99% { transform: translate3d(58px,0,0) scaleX(-1) rotate(0); } 77% { transform: translate3d(58px,0,0) scaleX(1) rotate(0); } 87% { transform: translate3d(25px,-2px,0) scaleX(1) rotate(-2deg); } 96%,100% { transform: translate3d(0,0,0) scaleX(1) rotate(0); } }
@keyframes dsh-rabbit-ecosystem { 0%,9% { transform: translate3d(0,0,0) scaleX(1) scaleY(1); } 13% { transform: translate3d(-18px,-10px,0) scaleX(1) scaleY(1.03); } 17% { transform: translate3d(-36px,0,0) scaleX(1) scaleY(.96); } 21%,31% { transform: translate3d(-36px,3px,0) scaleX(1) scaleY(.96); } 31.99% { transform: translate3d(-36px,3px,0) scaleX(1) scaleY(.96); } 32% { transform: translate3d(-36px,3px,0) scaleX(-1) scaleY(.96); } 43% { transform: translate3d(-8px,-9px,0) scaleX(-1) scaleY(1.03); } 49% { transform: translate3d(18px,0,0) scaleX(-1) scaleY(.97); } 54%,65% { transform: translate3d(18px,2px,0) scaleX(-1) scaleY(.96); } 65.99% { transform: translate3d(18px,2px,0) scaleX(-1) scaleY(.96); } 66% { transform: translate3d(18px,2px,0) scaleX(1) scaleY(.96); } 78% { transform: translate3d(-8px,-8px,0) scaleX(1) scaleY(1.03); } 84%,100% { transform: translate3d(0,0,0) scaleX(1) scaleY(1); } }
@keyframes dsh-alpaca-ecosystem { 0%,10% { transform: translate3d(0,0,0) scaleX(1) rotate(0); } 16% { transform: translate3d(-16px,-1px,0) scaleX(1) rotate(-1deg); } 24% { transform: translate3d(-38px,0,0) scaleX(1) rotate(0); } 29%,38% { transform: translate3d(-38px,4px,0) scaleX(1) rotate(-3deg); } 38.99% { transform: translate3d(-38px,4px,0) scaleX(1) rotate(-3deg); } 39% { transform: translate3d(-38px,4px,0) scaleX(-1) rotate(-3deg); } 54% { transform: translate3d(-10px,-1px,0) scaleX(-1) rotate(1deg); } 64% { transform: translate3d(12px,0,0) scaleX(-1) rotate(0); } 69%,76% { transform: translate3d(12px,3px,0) scaleX(-1) rotate(3deg); } 76.99% { transform: translate3d(12px,3px,0) scaleX(-1) rotate(3deg); } 77% { transform: translate3d(12px,3px,0) scaleX(1) rotate(3deg); } 90%,100% { transform: translate3d(0,0,0) scaleX(1) rotate(0); } }
.dsh-slot-widget-root .ecosystem-scene__switcher { position: static; display: grid; grid-template-columns: 22px 1fr 22px; align-items: center; gap: 4px; }
.dsh-slot-widget-root .ecosystem-scene__switcher strong { min-width: 0; overflow: hidden; border: 0; padding: 2px; color: #ffe08a; background: transparent; font-size: 11px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .habitat-arrow { display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid #6f5534; padding: 1px; background: linear-gradient(180deg,#19314d,#0c1d36); box-shadow: inset 0 -2px rgba(2,8,20,.48); cursor: pointer; -webkit-app-region: no-drag; }
.dsh-slot-widget-root .habitat-arrow:hover { border-color: #ffd05b; }
.dsh-slot-widget-root .habitat-arrow img { width: 16px; height: 12px; object-fit: contain; image-rendering: pixelated; }
.dsh-slot-widget-root .habitat-arrow--previous img { transform: scaleX(-1); }
.dsh-slot-widget-root .ecosystem-scene__status { position: static; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 3px 6px; font-size: 9px; }
.dsh-slot-widget-root .ecosystem-scene__resident { color: #7be0d3; font-size: 11px; }
.dsh-slot-widget-root .ecosystem-scene__status progress { grid-column: 1 / -1; width: 100%; height: 4px; border: 0; background: #071226; accent-color: #54d3c6; }
.dsh-slot-widget-root .ecosystem-scene__status progress::-webkit-progress-bar { background: #071226; box-shadow: inset 0 0 0 1px #294a55; }
.dsh-slot-widget-root .ecosystem-scene__status progress::-webkit-progress-value { background: #54d3c6; }
.dsh-slot-widget-root .ecosystem-scene__status progress::-moz-progress-bar { background: #54d3c6; }
.dsh-slot-widget-root .ecosystem-scene__status small { display: none; }
.dsh-slot-widget-root .ecosystem-scene__actions { position: static; display: grid; grid-template-columns: 68px minmax(0,1fr); align-items: center; gap: 7px; }
.dsh-slot-widget-root .ecosystem-scene__care { min-width: 0; min-height: 28px; justify-self: stretch; border-color: #c98b35; padding: 3px 6px; color: #fff0bd; background: linear-gradient(180deg,#263653,#17253e); -webkit-app-region: no-drag; }
.dsh-slot-widget-root .ecosystem-scene__interaction-notice { overflow: hidden; color: #f2cc7d; font-size: 9px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .ecosystem-scene__pause { margin: 0; color: #d9b073; font-size: 8px; text-align: center; }
.dsh-slot-widget-root .ecosystem-harmony { position: static; display: grid; grid-template-columns: 1fr; align-content: center; gap: 4px; font-size: 8px; text-align: center; }
.dsh-slot-widget-root .ecosystem-harmony progress { width: 100%; height: 4px; border: 0; background: #071226; accent-color: #e6a63e; }
.dsh-slot-widget-root .ecosystem-harmony progress::-webkit-progress-bar { background: #071226; box-shadow: inset 0 0 0 1px #5f4527; }
.dsh-slot-widget-root .ecosystem-harmony progress::-webkit-progress-value { background: #e6a63e; }
.dsh-slot-widget-root .ecosystem-harmony progress::-moz-progress-bar { background: #e6a63e; }
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
.dsh-slot-widget-root .combo-progress { margin: 6px 0 9px; border-left: 3px solid #e6a63e; padding: 4px 7px; color: #ffe0a0; background: rgba(230,166,62,.08); }
.dsh-slot-widget-root .workshop-section-title { margin: 12px 0 5px; color: #ffd477; font-size: 12px; }
.dsh-slot-widget-root .collectible-list--discoveries { grid-template-columns: 1fr 1fr; gap: 4px 8px; }
.dsh-slot-widget-root .collectible-row--discovery { grid-template-columns: 48px minmax(0,1fr); }
.dsh-slot-widget-root .collectible-row--discovery .discovery-status { grid-column: 2; color: #6da69f; font-size: 9px; }
.dsh-slot-widget-root .workshop-upgrade { display: grid; gap: 4px; margin-top: 11px; border: 1px solid #6d5431; padding: 8px; color: #a9c9ca; background: #0d1e36; }
.dsh-slot-widget-root .workshop-upgrade strong { color: #ffe08a; }
.dsh-slot-widget-root .workshop-upgrade progress { width: 100%; height: 8px; accent-color: #e6a63e; }
.dsh-slot-widget-root .spin-result-card { display: grid; width: 344px; gap: 9px; border: 2px solid #d29b3c; padding: 12px; color: #e4ddc8; background: linear-gradient(155deg,#132947,#09172e); box-shadow: 6px 6px 0 rgba(2,8,20,.62),inset 0 0 0 1px rgba(103,211,198,.18); font-size: 12px; }
.dsh-slot-widget-root .spin-result-card__eyebrow { color: #72d8cb; font-size: 10px; letter-spacing: .08em; }
.dsh-slot-widget-root .spin-result-card__reward { display: flex; align-items: center; gap: 12px; }
.dsh-slot-widget-root .spin-result-card__reward > div { display: grid; gap: 4px; }
.dsh-slot-widget-root .spin-result-card__reward strong,
.dsh-slot-widget-root .spin-result-card__title { color: #ffe08a; font-size: 16px; }
.dsh-slot-widget-root .spin-result-card__reward small { color: #89aaa9; }
.dsh-slot-widget-root .spin-result-card p { margin: 0; color: #b9c8c4; line-height: 1.55; }
.dsh-slot-widget-root .spin-result-card__actions { display: flex; flex-wrap: wrap; gap: 7px; }
.dsh-slot-widget-root .spin-result-card__primary { border-color: #d29b3c; background: #34324a; }
.dsh-slot-widget-root .collectible-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.dsh-slot-widget-root .collectible-row { display: grid; grid-template-columns: 48px minmax(0,1fr) auto; align-items: center; gap: 8px; min-height: 52px; border-bottom: 1px solid rgba(104,143,147,.28); }
.dsh-slot-widget-root .ecosystem-shop-list { grid-template-columns: 1fr 1fr; gap: 3px 8px; }
.dsh-slot-widget-root .ecosystem-shop-row { grid-template-columns: minmax(0,1fr) auto; min-height: 43px; }
.dsh-slot-widget-root .ecosystem-shop-row__copy { display: grid; gap: 2px; min-width: 0; }
.dsh-slot-widget-root .ecosystem-shop-row__copy strong { overflow: hidden; color: #f7e4bd; text-overflow: ellipsis; white-space: nowrap; }
.dsh-slot-widget-root .ecosystem-shop-row__copy small { color: #87a6a7; font-size: 9px; }
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
.dsh-slot-widget-root.desktop--overlay .plugin-game-layout { display: block; }
.dsh-slot-widget-root.desktop--overlay .ecosystem-widget { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .ecosystem-scene button { pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .slot-widget { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .game-canvas-wrap { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .slot-widget canvas { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .table-drop-hit-zone { pointer-events: none; }
.dsh-slot-widget-root.desktop--overlay .utility-panel-slot { position: absolute; right: calc(100% + 12px); bottom: 0; }
.dsh-slot-widget-root.desktop--overlay .utility-panel { max-height: min(470px,calc(100vh - 32px)); pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .scene-control { pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .widget-launchers .pixel-button { pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .slot-tool-console,
.dsh-slot-widget-root.desktop--overlay .slot-tool-console * { pointer-events: auto; }
.dsh-slot-widget-root.desktop--overlay .placed-collectible-drag-handle { pointer-events: auto; }
.dsh-slot-widget-root.desktop--companion { width: 100vw; height: 100vh; min-height: 0; overflow: hidden; padding: 0; color: #f7ddb0; background: transparent; }
.dsh-slot-widget-root.desktop--companion .companion-scale-surface { position: relative; width: 560px; height: var(--companion-base-height); overflow: hidden; padding: 5px 8px 7px; transform: scale(var(--companion-scale)); transform-origin: top left; filter: drop-shadow(0 8px 8px rgba(2,8,20,.58)); }
.dsh-slot-widget-root.desktop--companion .desktop__ambient { display: none; }
.dsh-slot-widget-root.desktop--companion .slot-widget-frame { cursor: move; -webkit-app-region: drag; }
.dsh-slot-widget-root.desktop--companion .game-canvas-wrap { -webkit-app-region: drag; cursor: move; }
.dsh-slot-widget-root.desktop--companion .slot-widget canvas { -webkit-app-region: drag; }
.dsh-slot-widget-root.desktop--companion .table-drop-hit-zone { -webkit-app-region: no-drag; }
.dsh-slot-widget-root.desktop--companion button,
.dsh-slot-widget-root.desktop--companion [draggable="true"] { -webkit-app-region: no-drag; }
.dsh-slot-widget-root.desktop--companion .host-status { width: 544px; min-height: 38px; margin: 3px 0; gap: 3px 8px; border: 1px solid #6f5534; padding: 3px 6px; font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .wallet-status strong { font-size: 14px; }
.dsh-slot-widget-root.desktop--companion .token-energy-meter { flex-basis: 210px; gap: 1px; }
.dsh-slot-widget-root.desktop--companion .token-energy-meter__label { grid-template-columns: 112px 1fr; gap: 4px; }
.dsh-slot-widget-root.desktop--companion .token-energy-meter progress { height: 6px; }
.dsh-slot-widget-root.desktop--companion .reward-source-status,
.dsh-slot-widget-root.desktop--companion .connection-status { display: none; }
.dsh-slot-widget-root.desktop--companion.has-utility-panel .host-status { display: none; }
.dsh-slot-widget-root.desktop--companion .widget-launchers .pixel-button { font-size: 9px; }
.dsh-slot-widget-root.desktop--companion .plugin-game-layout { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; }
.dsh-slot-widget-root.desktop--companion .slot-widget-frame { flex: 0 0 calc(var(--widget-height) + var(--control-deck-height)); }
.dsh-slot-widget-root.desktop--companion .utility-panel-slot { order: -1; width: 544px; }
.dsh-slot-widget-root.desktop--companion .utility-panel { width: 544px; max-height: 160px; border-width: 1px; padding: 5px; box-shadow: 3px 3px 0 rgba(2,8,20,.58); font-size: 10px; }
.dsh-slot-widget-root.desktop--companion .utility-panel__header { top: -5px; margin: -5px -5px 3px; border-bottom-width: 1px; padding: 3px 5px; }
.dsh-slot-widget-root.desktop--companion .utility-panel__header h2 { font-size: 12px; }
.dsh-slot-widget-root.desktop--companion .panel-close { min-width: 26px; min-height: 24px; font-size: 14px; }
.dsh-slot-widget-root.desktop--companion .set-progress,
.dsh-slot-widget-root.desktop--companion .panel-wallet { margin: 2px 0 4px; font-size: 9px; }
.dsh-slot-widget-root.desktop--companion .collectible-grid { grid-template-columns: repeat(6,minmax(0,1fr)); gap: 3px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell { height: 54px; padding: 1px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell .collectible-sprite { width: 48px; height: 48px; transform: scale(.8); transform-origin: top center; margin-bottom: -10px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell__copy strong { font-size: 8px; }
.dsh-slot-widget-root.desktop--companion .collectible-cell__copy small { display: none; }
.dsh-slot-widget-root.desktop--companion .spin-result-card { width: 544px; max-height: 160px; gap: 5px; overflow: auto; border-width: 1px; padding: 8px; font-size: 10px; box-shadow: 3px 3px 0 rgba(2,8,20,.58); }
.dsh-slot-widget-root.desktop--companion .spin-result-card__reward strong,
.dsh-slot-widget-root.desktop--companion .spin-result-card__title { font-size: 13px; }
.dsh-slot-widget-root.desktop--companion .spin-result-card .collectible-sprite { width: 48px; height: 48px; transform: scale(.8); margin: -5px; }
.dsh-slot-widget-root.desktop--companion .spin-result-card .pixel-button { min-height: 26px; padding: 3px 7px; font-size: 10px; }
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
  .dsh-slot-widget-root .plugin-game-layout { grid-template-columns: minmax(0,var(--widget-width)); }
  .dsh-slot-widget-root .utility-panel { width: min(344px,calc(100vw - 48px)); max-height: 42vh; }
  .dsh-slot-widget-root.desktop--overlay { right: 8px; bottom: 8px; }
  .dsh-slot-widget-root.desktop--overlay .utility-panel-slot { right: 0; bottom: calc(100% + 8px); }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-slot-widget-root *,
  .dsh-slot-widget-root *::before,
  .dsh-slot-widget-root *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
  .dsh-slot-widget-root .ecosystem-motion-layer { transform: none !important; animation: dsh-ecosystem-breathe 4s ease-in-out infinite !important; }
  .dsh-slot-widget-root .ecosystem-scene__habitat-stage { transform: none !important; animation: dsh-habitat-fade 180ms var(--ease-out) both !important; }
  .dsh-slot-widget-root .ecosystem-scene__atmosphere-layer { transform: none !important; animation: dsh-habitat-fade 180ms var(--ease-out) both !important; }
  .dsh-slot-widget-root .ecosystem-resident-interaction.is-reacting .ecosystem-resident-feedback-frame,
  .dsh-slot-widget-root .ecosystem-plot-cell.is-reacting .ecosystem-resident-feedback-frame { transform: none !important; animation: none !important; }
  .dsh-slot-widget-root .ecosystem-resident-feedback-frame { transition: none !important; }
  .dsh-slot-widget-root .ecosystem-resident-interaction:active .ecosystem-resident-feedback-frame,
  .dsh-slot-widget-root .ecosystem-plot-cell:active .ecosystem-resident-feedback-frame { transform: none !important; }
  .dsh-slot-widget-root .ecosystem-scene__reaction { transform: none !important; animation: dsh-reaction-confirm 180ms ease-out both !important; }
  .dsh-slot-widget-root .ecosystem-scene__reaction-effect { transform: none !important; animation: none !important; opacity: 1; }
  .dsh-slot-widget-root .ecosystem-scene__care-feedback { transform: translate3d(-50%,-50%,0) !important; animation: dsh-care-feedback-confirm 180ms var(--ease-out) both !important; }
  .dsh-slot-widget-root .ecosystem-scene__care-feedback::before { transform: none !important; animation: none !important; }
  .dsh-slot-widget-root .ecosystem-scene__habitat-drawer,
  .dsh-slot-widget-root .slot-tool-console .widget-launchers { transform: none !important; animation: none !important; }
  .dsh-slot-widget-root .pixel-button { transition: none !important; }
  .dsh-slot-widget-root .pixel-button:active:not(:disabled) { transform: none !important; }
  .dsh-slot-widget-root .desktop__ambient,
  .dsh-slot-widget-root .desktop__night-sky,
  .dsh-slot-widget-root [data-night-moonlight],
  .dsh-slot-widget-root .desktop__pixel-star,
  .dsh-slot-widget-root .ecosystem-scene__art,
  .dsh-slot-widget-root .ecosystem-scene__atmosphere-prop,
  .dsh-slot-widget-root .ecosystem-scene__night-glow,
  .dsh-slot-widget-root .ecosystem-scene__night-hotspot,
  .dsh-slot-widget-root [data-slot-night-light],
  .dsh-slot-widget-root .slot-widget canvas { transition: none !important; }
  .dsh-slot-widget-root .desktop__pixel-star,
  .dsh-slot-widget-root .ecosystem-scene__night-glow,
  .dsh-slot-widget-root .ecosystem-scene__night-hotspot,
  .dsh-slot-widget-root .ecosystem-scene__sleep-mark,
  .dsh-slot-widget-root [data-slot-night-light],
  .dsh-slot-widget-root [data-slot-bulb] { animation: none !important; }
  .dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-hotspot { opacity: .84 !important; }
  .dsh-slot-widget-root[data-day-phase="night"] [data-slot-bulb] { opacity: .78 !important; }
}
@keyframes dsh-reaction-confirm { from { opacity: 0; } to { opacity: 1; } }
@keyframes dsh-ecosystem-breathe { from { opacity: .92; } to { opacity: 1; } }
`;

export function installPluginStyle(target: Pick<Document, "createElement" | "head">): () => void {
  const style = target.createElement("style");
  style.dataset.dshSlotWidget = "";
  style.textContent = PLUGIN_STYLE;
  target.head.append(style);
  return () => style.remove();
}
