import "reflect-metadata";
import { once } from "node:events";
import { request as createHttpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { Container, Context as FrameworkContext } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get } from "@croco/protocols-rest";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";

describe("Node request abort signal", () => {
  let server: ServerType | undefined;
  let resolveRequestSignal: ((signal: AbortSignal) => void) | undefined;
  let requestSignal: Promise<AbortSignal>;

  @Controller("/abort")
  class AbortControllerFixture {
    @Get("/wait")
    async waitForDisconnect(): Promise<Response> {
      const signal = FrameworkContext.getRuntimeContext()?.abortSignal;

      if (!signal) {
        return new Response("missing abort signal", { status: 500 });
      }

      resolveRequestSignal?.(signal);

      if (!signal.aborted) {
        await once(signal, "abort");
      }

      return new Response(null, { status: 204 });
    }
  }

  beforeEach(() => {
    Container.reset();
    requestSignal = new Promise((resolve) => {
      resolveRequestSignal = resolve;
    });

    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  afterEach(async () => {
    if (server) {
      const closed = once(server, "close");
      server.close();
      await closed;
      server = undefined;
    }
  });

  it("aborts the handler signal when the Node client disconnects", async () => {
    const app = createApp({
      controllers: [AbortControllerFixture],
      securityValidation: "off",
    });
    server = serve({ fetch: app.nodeHandler(), port: 0 });

    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address() as AddressInfo;
    const clientRequest = createHttpRequest({
      host: "127.0.0.1",
      port: address.port,
      path: "/abort/wait",
    });
    clientRequest.on("error", () => undefined);
    clientRequest.end();

    const signal = await requestSignal;

    expect(signal.aborted).toBe(false);

    const aborted = once(signal, "abort");
    clientRequest.destroy();
    await aborted;

    expect(signal.aborted).toBe(true);
  });
});
