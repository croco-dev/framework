import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { App } from "./App";
const root = document.getElementById("root");
if (!root) throw new Error("Root element is required");
createRoot(root).render(createElement(App));
