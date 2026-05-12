import { defineRoute, head } from "@croco/meta-vite";

export default defineRoute({
  path: "/",
  mode: "ssr",
  component: Page satisfies typeof import("./index/Page").default,
  head: head({ title: "Croco Console" }),
});
