import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderRoute } from "./app/routes";
import { registerServiceWorker } from "./lib/pwa";
import "./styles/index.css";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>{renderRoute()}</StrictMode>,
);
