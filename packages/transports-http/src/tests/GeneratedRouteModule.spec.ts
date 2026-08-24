import "reflect-metadata";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Container } from "@croco/framework-context";
import { compileRoutes, generateModule } from "@croco/framework-routes";
import { ProblemFactory } from "@croco/problems-core";
import { HttpMethod } from "@croco/protocols-rest";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp as createCrocoApp } from "../libs/CrocoApp";
import { GeneratedRouteController } from "./fixtures/GeneratedRouteController";

describe("generated route module", () => {
  it("invokes DI-resolved controllers and preserves Problem handling in Hono", async () => {
    const outputDir = await mkdtemp(join(process.cwd(), ".croco-framework-routes-runtime-"));

    try {
      const moduleUrl = new URL("./fixtures/GeneratedRouteController.ts", import.meta.url).href;
      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });
      Container.set(GeneratedRouteController, {
        all: () => new Response("all controller response"),
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
        all: () => new Response("all controller response"),
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

  it("executes @All handlers equivalently through generated and reflection registration", async () => {
    const outputDir = await mkdtemp(join(process.cwd(), ".croco-framework-routes-all-runtime-"));

    try {
      const moduleUrl = new URL("./fixtures/GeneratedRouteController.ts", import.meta.url).href;
      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });
      Container.set(GeneratedRouteController, new GeneratedRouteController());

      const generated = await import(
        `${new URL(`file://${join(outputDir, ".croco", "build", "routes.mjs")}`).href}?${Date.now()}`
      );
      const generatedApp = new Hono();
      generated.registerRoutes(generatedApp);
      const reflectionApp = createCrocoApp({
        controllers: [GeneratedRouteController],
        securityValidation: "off",
        diValidation: "off",
      });

      const concreteHttpMethods = Object.values(HttpMethod).filter(
        (method) => method !== HttpMethod.ALL,
      );

      for (const method of concreteHttpMethods) {
        const generatedResponse = await generatedApp.request(
          new Request("http://localhost/generated/all", { method }),
        );
        const reflectionResponse = await reflectionApp.fetch(
          new Request("http://localhost/generated/all", { method }),
        );

        expect(generatedResponse.status).toBe(200);
        expect(reflectionResponse.status).toBe(generatedResponse.status);
        await expect(reflectionResponse.text()).resolves.toBe(await generatedResponse.text());
      }
    } finally {
      Container.reset();
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("preserves catch-all parameter matching in generated route modules", async () => {
    const outputDir = await mkdtemp(join(process.cwd(), ".croco-framework-routes-catch-all-"));

    try {
      const moduleUrl = new URL("./fixtures/GeneratedCatchAllController.ts", import.meta.url).href;
      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });

      const generated = await import(
        `${new URL(`file://${join(outputDir, ".croco", "build", "routes.mjs")}`).href}?${Date.now()}`
      );
      const app = new Hono();
      generated.registerRoutes(app);

      const prefixedResponse = await app.request(
        "http://localhost/generated/assets/icons/logo.svg",
      );
      const ordinaryResponse = await app.request("http://localhost/generated/items/42");
      const rootResponse = await app.request("http://localhost/public/fonts/inter.woff2");

      expect(prefixedResponse.status).toBe(200);
      await expect(prefixedResponse.text()).resolves.toBe("icons/logo.svg");
      expect(ordinaryResponse.status).toBe(200);
      await expect(ordinaryResponse.text()).resolves.toBe("42");
      expect(rootResponse.status).toBe(200);
      await expect(rootResponse.text()).resolves.toBe("public/fonts/inter.woff2");
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
