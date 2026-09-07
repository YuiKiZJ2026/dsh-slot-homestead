import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./preview.css";
import { PreviewSandbox } from "./PreviewSandbox";

function mountPreview() { createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewSandbox />
  </StrictMode>,
);
}

// Native preview must use exactly the bundled companion CSS, not legacy page positioning.
if (new URLSearchParams(window.location.search).get("display") === "companion") mountPreview();
else void import("../../styles/global.css").then(mountPreview);
