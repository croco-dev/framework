import type { default as Page } from "./index/Page";
import { defineRoute, head } from "@croco/meta-vite";

export default defineRoute({
  path: "/",
  mode: "ssr",
  component: Page satisfies Page,
  head: head({ title: "Croco Console" }),
});
