import { defineRoute, head, RouteRegistry } from "@croco/meta-vite";
import Page from "./index/+Page";

const registry = new RouteRegistry();

registry.register(
  defineRoute({
    path: "/",
    component: Page,
    mode: "ssr",
    head: head({ title: "{{projectName}}" }),
  }),
);

export default registry;
