import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoutes } from "./AppRoutes";
import type { ComponentType } from "react";

const pages = import.meta.glob<{ routeConfig: { path: string; Component: ComponentType } }>(
  "../pages/**/route.ts",
  { eager: true },
);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppRoutes routes={Object.values(pages).map(({ routeConfig }) => routeConfig)} />
  </React.StrictMode>,
);
