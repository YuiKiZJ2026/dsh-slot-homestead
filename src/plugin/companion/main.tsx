import { createRoot } from "react-dom/client";
import { PluginApp } from "../client/PluginApp";
import { HttpGameApi } from "../client/api";
import { installPluginStyle } from "../client/style";
import collectiblesUrl from "../client/assets/collectibles.png";
import reelsUrl from "../client/assets/reel-symbols-runtime.png";
import sceneUrl from "../client/assets/scene-base.png";

const apiBase = validatedApiBase(new URLSearchParams(window.location.search).get("apiBase"));
const assets = {
  scene: sceneUrl,
  reels: reelsUrl,
  collectibles: collectiblesUrl,
};

installPluginStyle(document);
createRoot(document.getElementById("root")!).render(
  <PluginApp
    api={new HttpGameApi(globalThis.fetch.bind(globalThis), apiBase)}
    sessionId="dsh-slot-widget-global"
    assetUrls={assets}
    displayMode="companion"
  />,
);

function validatedApiBase(value: string | null): string {
  if (value === null) throw new Error("Missing DSH Host API address");
  const parsed = new URL(value);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
    parsed.username !== "" || parsed.password !== "" ||
    !/^\/[A-Za-z0-9_-]{16,128}$/.test(parsed.pathname) ||
    parsed.search !== "" || parsed.hash !== ""
  ) throw new Error("The DSH Host API address must be an uncredentialed loopback HTTP origin");
  return `${parsed.origin}${parsed.pathname}`;
}
