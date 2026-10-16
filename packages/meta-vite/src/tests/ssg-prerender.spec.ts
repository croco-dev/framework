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

  it.each([
    ["/docs", "/docs/"],
    ["/docs/", "/docs"],
  ])("rejects colliding output paths for %s and %s before rendering", async (first, second) => {
    const registry = new RouteRegistry();
    const component = vi.fn(() => createElement("main", null, "No slash"));
    const trailingComponent = vi.fn(() => createElement("main", null, "Trailing slash"));
    registry.register({ path: "/about", mode: "ssg", component });
    registry.register({ path: first, mode: "ssg", component });
    registry.register({ path: second, mode: "ssg", component: trailingComponent });

    const result = prerenderSsgRoutes(registry.compile());

    await expect(result).rejects.toMatchObject({
      code: "CROCO_META_VITE_SSG_OUTPUT_CONFLICT",
      detail: expect.stringContaining(first),
      extensions: { outputPath: "docs/index.html", routes: [first, second] },
    });
    await expect(result).rejects.toThrow(/docs\/index\.html/);
    await expect(result).rejects.toThrow(second);
    expect(component).not.toHaveBeenCalled();
    expect(trailingComponent).not.toHaveBeenCalled();
  });

  it("preserves distinct output paths and ignores non-SSG aliases", async () => {
    const registry = new RouteRegistry();
    for (const [path, text, mode] of [
      ["/", "Home", "ssg"],
      ["/docs", "Docs", "ssg"],
      ["/about/", "About", "ssg"],
      ["/docs/", "Dynamic docs", "ssr"],
    ] as const) {
      registry.register({ path, mode, component: () => createElement("main", null, text) });
    }

    await expect(prerenderSsgRoutes(registry.compile())).resolves.toEqual([
      { path: "index.html", format: "esm", type: "asset", html: "<main>Home</main>" },
      { path: "docs/index.html", format: "esm", type: "asset", html: "<main>Docs</main>" },
      { path: "about/index.html", format: "esm", type: "asset", html: "<main>About</main>" },
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
