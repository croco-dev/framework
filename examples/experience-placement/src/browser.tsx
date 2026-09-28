import { createElement as h } from "react";
import { hydrateRoot } from "react-dom/client";
import { DemoApp } from "./App";
import type { DemoBootstrap } from "./App";

declare global {
  interface Window {
    __EXPERIENCE_BOOTSTRAP__: DemoBootstrap;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Example root is missing");
hydrateRoot(root, h(DemoApp, { initial: window.__EXPERIENCE_BOOTSTRAP__ }));
