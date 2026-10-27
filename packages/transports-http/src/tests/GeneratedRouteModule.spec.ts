import "reflect-metadata";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Container } from "@croco/framework-context";
import { compileRoutes, generateModule } from "@croco/framework-routes";
import { ProblemFactory } from "@croco/problems-core";
import { Controller, Get, HttpMethod, defineRouteContract } from "@croco/protocols-rest";
import { z } from "zod";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp as createCrocoApp } from "../libs/CrocoApp";
import {
  GeneratedArgumentsController,
  RejectGeneratedRequest,
} from "./fixtures/GeneratedArgumentsController";
import { GeneratedRouteController } from "./fixtures/GeneratedRouteController";
import {
  GeneratedCatchAllController,
  GeneratedRootCatchAllController,
} from "./fixtures/GeneratedCatchAllController";

async function createGeneratedModuleDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(process.cwd(), prefix));
  try {
    const dependencies = join(directory, "node_modules", "@croco");
    await mkdir(dependencies, { recursive: true });
    await symlink(
      fileURLToPath(new URL("../../", import.meta.url)),
      join(dependencies, "transports-http"),
      "dir",
    );
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

describe("generated route module", () => {
  it("binds decorated arguments and validates bodies like reflection routes while preserving raw Hono handlers", async () => {
    const outputDir = await createGeneratedModuleDirectory(".croco-generated-arguments-");
    try {
      const moduleUrl = new URL("./fixtures/GeneratedArgumentsController.ts", import.meta.url).href;
      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });
      Container.set(GeneratedArgumentsController, new GeneratedArgumentsController());
      Container.set(RejectGeneratedRequest, new RejectGeneratedRequest());
      const generated = await import(
        new URL(`file://${join(outputDir, ".croco", "build", "routes.mjs")}`).href
      );
      const app = new Hono();
      generated.registerRoutes(app);
      const reflection = createCrocoApp({
        controllers: [GeneratedArgumentsController],
        securityValidation: "off",
        diValidation: "off",
      });

      for (const request of [
        new Request("http://localhost/arguments/item-42?view=detail", {
          headers: { "x-tenant": "tenant-7" },
        }),
        new Request("http://localhost/arguments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Widget" }),
        }),
        new Request("http://localhost/arguments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "" }),
        }),
      ]) {
        const actual = await app.request(request.clone());
        const expected = await reflection.fetch(request.clone());
        expect(actual.status).toBe(expected.status);
        if (actual.status < 400) {
          const body = await actual.json();
          expect(body).toEqual(await expected.json());
          expect(body).toEqual(
            request.method === "GET"
              ? { id: "item-42", view: "detail", tenant: "tenant-7" }
              : { name: "Widget" },
          );
        } else {
          expect(actual.status).toBe(422);
          expect(await actual.json()).toMatchObject({ status: 422 });
          expect(actual.headers.get("content-type")).toBe(expected.headers.get("content-type"));
        }
      }
      const denied = await app.request("http://localhost/arguments/guarded/check");
      expect(denied.status).toBe(403);
      expect(await denied.json()).not.toHaveProperty("leaked");
      const invalidOutput = await app.request("http://localhost/arguments/invalid/output");
      expect(invalidOutput.status).toBe(500);
      expect(await invalidOutput.json()).not.toHaveProperty("count");
      const raw = await app.request("http://localhost/arguments/raw/context?value=hono-value");
      expect(raw.status).toBe(200);
      expect(await raw.text()).toBe("hono-value");
      const legacyPath = join(outputDir, "legacy.mjs");
      await writeFile(
        legacyPath,
        generateModule([
          {
            className: "GeneratedArgumentsController",
            basePath: "/arguments",
            routes: [{ method: "GET", path: "/:id", handlerName: "read" }],
          },
        ]),
      );
      const legacy = await import(new URL(`file://${legacyPath}`).href);
      expect(() => legacy.registerRoutes(new Hono(), { GeneratedArgumentsController })).toThrow(
        "missing-rest-invocation",
      );
    } finally {
      Container.reset();
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("checks a contract route independently of an earlier raw route on the same handler", async () => {
    const contract = defineRouteContract({
      method: HttpMethod.GET,
      path: "/stacked/contract",
      response: z.object({ value: z.string() }),
    });
    @Controller("/stacked")
    class StackedController {
      @Get(contract)
      @Get("/raw")
      read() {
        return { value: "contract-value" };
      }
    }
    const outputDir = await createGeneratedModuleDirectory(".croco-generated-stacked-");
    try {
      const path = join(outputDir, "legacy.mjs");
      await writeFile(
        path,
        generateModule([
          {
            className: "StackedController",
            basePath: "/stacked",
            routes: [
              { method: "GET", path: "/raw", handlerName: "read" },
              { method: "GET", path: "/contract", handlerName: "read" },
            ],
          },
        ]),
      );
      const rawPath = join(outputDir, "raw-only.mjs");
      await writeFile(
        rawPath,
        generateModule([
          {
            className: "StackedController",
            basePath: "/stacked",
            routes: [{ method: "GET", path: "/raw", handlerName: "read" }],
          },
        ]),
      );
      const rawOnly = await import(new URL(`file://${rawPath}`).href);
      expect(() => rawOnly.registerRoutes(new Hono(), { StackedController })).not.toThrow();
      const generated = await import(new URL(`file://${path}`).href);
      expect(() => generated.registerRoutes(new Hono(), { StackedController })).toThrow(
        "missing-rest-invocation",
      );
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("invokes DI-resolved controllers and preserves Problem handling in Hono", async () => {
    const outputDir = await createGeneratedModuleDirectory(".croco-framework-routes-runtime-");

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
    const outputDir = await createGeneratedModuleDirectory(".croco-framework-routes-bindings-");

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
    const outputDir = await createGeneratedModuleDirectory(".croco-framework-routes-all-runtime-");

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
    const outputDir = await createGeneratedModuleDirectory(".croco-framework-routes-catch-all-");

    try {
      const moduleUrl = new URL("./fixtures/GeneratedCatchAllController.ts", import.meta.url).href;
      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });
      Container.set(GeneratedCatchAllController, new GeneratedCatchAllController());
      Container.set(GeneratedRootCatchAllController, new GeneratedRootCatchAllController());

      const generated = await import(
        `${new URL(`file://${join(outputDir, ".croco", "build", "routes.mjs")}`).href}?${Date.now()}`
      );
      const app = new Hono();
      generated.registerRoutes(app, {
        GeneratedCatchAllController,
        GeneratedRootCatchAllController,
      });

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
