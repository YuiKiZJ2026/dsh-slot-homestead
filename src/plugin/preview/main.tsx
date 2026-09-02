import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles/global.css";
import "./preview.css";
import { PreviewSandbox } from "./PreviewSandbox";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewSandbox />
  </StrictMode>,
);
