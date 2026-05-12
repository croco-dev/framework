import { OutputContractValidator } from "@croco/presentation-preset";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { prerenderSsgRoutes } from "../libs/build/ssgPrerender";
import { createMetaOutputContract } from "../libs/output/outputContract";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { RenderRouteIR } from "../libs/routes/types";

describe("prerenderSsgRoutes", () => {
  it("renders SSG routes as static HTML artifacts", async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/about",
        mode: "ssg",
        component: () => createElement("main", null, "About"),
      }),
    );
    registry.register(
      defineRoute({
        path: "/dashboard",
        mode: "ssr",
        component: () => createElement("main", null, "SSR"),
      }),
    );

    const artifacts = await prerenderSsgRoutes(registry.compile());

    expect(artifacts).toEqual([
      {
        path: "about/index.html",
        format: "esm",
        type: "asset",
        html: "<main>About</main>",
      },
    ]);
  });

  it("returns OutputContract-compatible static artifacts", async () => {
    const route = createSsgRoute("/about", "<main>Static About</main>");
    const artifacts = await prerenderSsgRoutes([route], async () => "<main>Static About</main>");
    const contract = createMetaOutputContract({
      presetName: "meta-vite",
      clientEntry: "client/index.js",
      ssrEntry: "ssr/entry.js",
      rscEntry: "rsc/entry.js",
    });
    const outputContract = {
      ...contract,
      artifacts: [...contract.artifacts, ...artifacts.map(({ html, ...artifact }) => artifact)],
    };
    const report = new OutputContractValidator().validate(outputContract);

    expect(report.results.filter((result) => result.severity === "error")).toHaveLength(0);
    expect(outputContract.artifacts).toEqual(
      expect.arrayContaining([{ path: "about/index.html", format: "esm", type: "asset" }]),
    );
  });

  it("does not invoke controller or API handlers during build", async () => {
    const controller = vi.fn();
    const route = createSsgRoute("/about", "<main>Static About</main>");

    const artifacts = await prerenderSsgRoutes([route], async () => "<main>Static About</main>");

    expect(artifacts[0]?.html).toBe("<main>Static About</main>");
    expect(controller).not.toHaveBeenCalled();
  });

  it("maps the root route to index.html", async () => {
    const route = createSsgRoute("/", "<main>Home</main>");

    const artifacts = await prerenderSsgRoutes([route], async () => "<main>Home</main>");

    expect(artifacts[0]?.path).toBe("index.html");
  });
});

function createSsgRoute(path: string, html: string): RenderRouteIR {
  return {
    path,
    mode: "ssg",
    componentLoader: async () => ({ default: () => createElement("main", null, html) }),
  };
}
