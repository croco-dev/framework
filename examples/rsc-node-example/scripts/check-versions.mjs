import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const reactVersion = require("react/package.json").version;
const reactDomVersion = require("react-dom/package.json").version;
const pluginVersion = require("@vitejs/plugin-rsc/package.json").version;

if (reactVersion !== reactDomVersion) {
  throw new Error(`react (${reactVersion}) and react-dom (${reactDomVersion}) must match`);
}
const [major] = reactVersion.split(".");
if (major !== "19") {
  throw new Error(`rsc-node-example requires React 19, got ${reactVersion}`);
}
console.log(`[rsc-node-example] react ${reactVersion} / plugin-rsc ${pluginVersion}`);
