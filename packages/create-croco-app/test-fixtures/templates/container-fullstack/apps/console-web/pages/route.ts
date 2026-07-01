import { defineRoute, head, type PageRouteDefinition } from "@croco/meta-vite";
import Page from "./index/Page";

const route = {
  path: "/",
  mode: "ssr",
  component: Page,
  head: head({ title: "Croco" }),
} satisfies PageRouteDefinition;

export default defineRoute(route);
