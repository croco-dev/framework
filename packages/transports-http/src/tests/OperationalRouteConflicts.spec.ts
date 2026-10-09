import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { Problem } from "@croco/problems-core";
import { All, Controller, Get, Head, Post } from "@croco/protocols-rest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import type { AppConfig } from "../libs/types";

function controllerAt(path: string, method: "GET" | "ALL" | "POST" | "HEAD" = "GET") {
  const decorate = { GET: Get, ALL: All, POST: Post, HEAD: Head }[method];
  @Controller(path)
  class ApplicationController {
    @decorate("/")
    handle() {
      return { source: "application" };
    }
  }
  return ApplicationController;
}

function appAt(
  path: string,
  options: Partial<AppConfig> = {},
  method: "GET" | "ALL" | "POST" | "HEAD" = "GET",
) {
  return createApp({
    controllers: [controllerAt(path, method)],
    securityValidation: "off",
    diagnostics: { exposure: "off" },
    devInspector: { exposure: "off" },
    ...options,
  });
}

describe("operational route conflicts", () => {
  beforeEach(() => {
    Container.reset();
    vi.stubEnv("CROCO_DIAGNOSTICS_EXPOSURE", "off");
    vi.stubEnv("CROCO_DEV_INSPECTOR_EXPOSURE", "off");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["/health", "/health/live", "/health/ready", "/ready", "/metrics"])(
    "rejects GET %s with a Problem identifying the controller method",
    (path) => {
      expect(() => appAt(path).getHono()).toThrowError(
        expect.objectContaining({
          code: "transports-http/duplicate-route-definition",
          detail: expect.stringContaining(`GET ${path}`),
        }),
      );
      expect(() => appAt(path).getHono()).toThrowError(/ApplicationController.handle/);
      expect(() => appAt(path).getHono()).toThrowError(Problem);
    },
  );

  it("rejects ALL on an operational path", () => {
    expect(() => appAt("/metrics", {}, "ALL").getHono()).toThrowError(/ALL \/metrics/);
  });

  it("normalizes a trailing slash before detecting the conflict", () => {
    expect(() => appAt("/metrics/").getHono()).toThrowError(/GET \/metrics/);
  });

  it.each(["/diagnostics", "/health/diagnostics"])(
    "rejects enabled diagnostics path %s",
    (path) => {
      expect(() => appAt(path, { diagnostics: { exposure: "private" } }).getHono()).toThrowError(
        /ApplicationController.handle/,
      );
    },
  );

  it("reserves diagnostics enabled through environment configuration", () => {
    vi.stubEnv("CROCO_DIAGNOSTICS_EXPOSURE", "private");
    expect(() => appAt("/diagnostics", { diagnostics: undefined }).getHono()).toThrowError(
      /GET \/diagnostics/,
    );
  });

  it("rejects the enabled inspector path", () => {
    expect(() =>
      appAt("/dev/inspector", { devInspector: { exposure: "private" } }).getHono(),
    ).toThrowError(/ApplicationController.handle/);
  });

  it.each(["/diagnostics", "/health/diagnostics", "/dev/inspector", "/ops/metrics"])(
    "dispatches the application handler on available path %s",
    async (path) => {
      const response = await appAt(path).fetch(new Request(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ source: "application" });
    },
  );

  it("allows POST on an operational GET path", async () => {
    const response = await appAt("/metrics", {}, "POST").fetch(
      new Request("http://localhost/metrics", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ source: "application" });
  });

  it("keeps explicit HEAD outside the conflict check", () => {
    expect(() => appAt("/metrics", {}, "HEAD").getHono()).not.toThrow();
  });
});
