import "reflect-metadata";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Container } from "@croco/framework-context";
import { compileRoutes, generateModule } from "@croco/framework-routes";
import { ProblemFactory } from "@croco/problems-core";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { GeneratedRouteController } from "./fixtures/GeneratedRouteController";

describe("generated route module", () => {
  it("invokes DI-resolved controllers and preserves Problem handling in Hono", async () => {
    const outputDir = await mkdtemp(join(process.cwd(), ".croco-framework-routes-runtime-"));

    try {
      const moduleUrl = new URL("./fixtures/GeneratedRouteController.ts", import.meta.url).href;
      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });
      Container.set(GeneratedRouteController, {
        get: () => new Response("generated DI controller response"),
        problem: () => {
          throw ProblemFactory.validationError("generated-problem", "generated problem");
        },
      });

      const generated = await import(
        `${new URL(`file://${join(outputDir, ".croco", "build", "routes.mjs")}`).href}?${Date.now()}`
      );
      const app = new Hono();
      app.onError((error, c) => {
        if (hasProblemStatus(error)) {
          return new Response(JSON.stringify({ code: "generated-problem" }), {
            status: error.status,
            headers: { "content-type": "application/json" },
          });
        }

        return c.text("unexpected error", 500);
      });

      generated.registerRoutes(app);

      const response = await app.request("http://localhost/generated");
      const problemResponse = await app.request("http://localhost/generated/problem");

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("generated DI controller response");
      expect(problemResponse.status).toBe(422);
      await expect(problemResponse.json()).resolves.toEqual({ code: "generated-problem" });
    } finally {
      Container.reset();
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("accepts explicit controller bindings when a generated module has no imports", async () => {
    const outputDir = await mkdtemp(join(process.cwd(), ".croco-framework-routes-bindings-"));

    try {
      const routesModulePath = join(outputDir, "routes.mjs");
      await writeFile(
        routesModulePath,
        generateModule([
          {
            basePath: "/generated",
            className: "GeneratedRouteController",
            routes: [{ method: "GET", path: "", handlerName: "get" }],
          },
        ]),
        "utf-8",
      );
      Container.set(GeneratedRouteController, {
        get: () => new Response("explicit controller binding response"),
        problem: () => {
          throw ProblemFactory.validationError("generated-problem", "generated problem");
        },
      });

      const generated = await import(`${new URL(`file://${routesModulePath}`).href}?${Date.now()}`);
      const app = new Hono();
      generated.registerRoutes(app, { GeneratedRouteController });

      const response = await app.request("http://localhost/generated");

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("explicit controller binding response");
    } finally {
      Container.reset();
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

function hasProblemStatus(error: unknown): error is { readonly status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  );
}
