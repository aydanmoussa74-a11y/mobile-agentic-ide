import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderRoute } from "./app/routes";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{renderRoute()}</StrictMode>,
);
