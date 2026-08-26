import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles/global.css";
import { PluginApp } from "../client/PluginApp";
import { InMemoryGameApi } from "./InMemoryGameApi";

const previewAssets = {
  scene: "/assets/scene-base.png",
  reels: "/assets/reel-symbols-runtime.png",
  collectibles: "/assets/collectibles.png",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PluginApp
      api={new InMemoryGameApi()}
      sessionId="native-preview"
      assetUrls={previewAssets}
    />
  </StrictMode>,
);
