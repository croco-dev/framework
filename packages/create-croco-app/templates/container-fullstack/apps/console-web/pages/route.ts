import type { default as PageComponent } from "./index/Page";
import { defineRoute, head } from "@croco/meta-vite";

export default defineRoute({
  path: "/",
  mode: "ssr",
  component: undefined as PageComponent,
  head: head({ title: "Croco" }),
});
