import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
} from "@croco/framework-module";
import { describe, expect, it, vi } from "vitest";
import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import { createHttpAppConfig, HTTP_TRANSPORT_OPTIONS_TOKEN, httpTransport } from "../index";
import type { CrocoHttpContext, MiddlewareFunction } from "../libs/types";

describe("httpTransport", () => {
  it("projects deterministic controller, middleware, and diagnostics contributions", async () => {
    class FirstController {}
    class SecondController {}
    const firstMiddleware: MiddlewareFunction = async (_ctx: CrocoHttpContext, next) => next();
    const secondMiddleware: MiddlewareFunction = async (_ctx: CrocoHttpContext, next) => next();
    const diagnostics: DiagnosticsProvider = {
      name: "example",
      getHealth: vi.fn(async () => ({
        status: "healthy" as const,
        component: "example",
        lastChecked: new Date().toISOString(),
      })),
    };
    const plugin = httpTransport({
      controllers: [
        { id: "second", order: 20, controller: SecondController },
        { id: "first", order: 10, controller: FirstController },
      ],
      middlewares: [
        { id: "second", order: 20, middleware: secondMiddleware },
        { id: "first", order: 10, middleware: firstMiddleware },
      ],
      securityValidation: "off",
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [
          plugin,
          defineCrocoModule({
            name: "example-diagnostics",
            contributions: [
              {
                kind: "diagnostics.provider",
                id: diagnostics.name,
                value: diagnostics,
              },
            ],
          }),
        ],
      }),
    );

    await runtime.initialize();

    expect(runtime.get(HTTP_TRANSPORT_OPTIONS_TOKEN)).toMatchObject({
      securityValidation: "off",
    });
    expect(createHttpAppConfig(runtime)).toEqual({
      controllers: [FirstController, SecondController],
      middlewares: [firstMiddleware, secondMiddleware],
      securityValidation: "off",
      diagnostics: { providers: [diagnostics] },
    });
    expect(runtime.createGraphManifest().plugins).toEqual([
      expect.objectContaining({
        name: "transports-http",
        packageName: "@croco/transports-http",
        maturity: "production",
        capabilities: expect.arrayContaining([
          { id: "http.transport", kind: "single" },
          { id: "http.controller", kind: "multi" },
          { id: "http.middleware", kind: "multi" },
          { id: "diagnostics.provider", kind: "multi" },
        ]),
      }),
    ]);

    await runtime.dispose();
  });
});
