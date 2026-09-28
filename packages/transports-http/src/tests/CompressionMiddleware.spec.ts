import "reflect-metadata";
import { gunzipSync } from "node:zlib";

import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { compressionMiddleware } from "../libs/middleware/CompressionMiddleware";
import type { MiddlewareFunction } from "../libs/types";

const LARGE_PAYLOAD = "compressible response payload ".repeat(256);

@Controller("/compression")
class CompressionController {
  @Get("/large-json")
  largeJson() {
    return { payload: LARGE_PAYLOAD };
  }

  @Get("/small-json")
  smallJson() {
    return { payload: "small" };
  }

  @Get("/image")
  image(): Response {
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: {
        "Content-Type": "image/png",
      },
    });
  }

  @Get("/error")
  error(): Response {
    return new Response(LARGE_PAYLOAD, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  @Get("/stream")
  stream(): Response {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(LARGE_PAYLOAD));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}

const staleContentLengthMiddleware: MiddlewareFunction = async (_ctx, next) => {
  const response = await next();
  if (!(response instanceof Response)) return response;

  const body = await response.clone().arrayBuffer();
  response.headers.set("Content-Length", String(body.byteLength));

  return response;
};

const replacementResponseMiddleware: MiddlewareFunction = async (_ctx, next) => {
  await next();

  return new Response(LARGE_PAYLOAD, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
};

describe("compressionMiddleware", () => {
  beforeEach(() => {
    Container.reset();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
      child: () => logger,
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  it("returns gzip bytes for a large compressible response", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 64, encodings: ["gzip"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/large-json", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
    expect(response.headers.get("Content-Length")).toBeNull();

    const compressed = Buffer.from(await response.arrayBuffer());
    const decoded = gunzipSync(compressed).toString("utf-8");

    expect(JSON.parse(decoded)).toEqual({ payload: LARGE_PAYLOAD });
  });

  it.each([
    { name: "rejects a preferred encoding with q=0", header: "gzip; q=0, br; q=1", expected: "br" },
    {
      name: "leaves all rejected encodings uncompressed",
      header: "gzip;q=0, br;q=0",
      expected: null,
    },
    {
      name: "keeps a duplicate q=0 exclusion",
      header: "gzip;q=0, gzip;q=1, br;q=0.5",
      expected: "br",
    },
    { name: "selects the higher quality encoding", header: "gzip;q=0.2, br;q=0.8", expected: "br" },
    {
      name: "uses configured preference for equal quality",
      header: "br;q=0.8, gzip;q=0.8",
      expected: "gzip",
    },
    {
      name: "uses a wildcard for an unlisted encoding",
      header: "gzip;q=0, *;q=0.7",
      expected: "br",
    },
    {
      name: "keeps an explicit encoding above a rejected wildcard",
      header: "*;q=0, br;q=0.5",
      expected: "br",
    },
    { name: "uses configured preference for a wildcard", header: "*", expected: "gzip" },
    { name: "does not compress for an empty header", header: "", expected: null },
    { name: "does not compress without a header", header: undefined, expected: null },
    { name: "ignores an invalid quality value", header: "gzip;q=1.5, br;q=0.4", expected: "br" },
  ])("$name", async ({ header, expected }) => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 64, encodings: ["gzip", "br"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/large-json", {
        headers: header === undefined ? undefined : { "Accept-Encoding": header },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBe(expected);
  });

  it("keeps header order when configured preference omits both encodings", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 64, encodings: ["gzip"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/large-json", {
        headers: { "Accept-Encoding": "deflate, br" },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBe("deflate");
  });

  it("removes stale content length from compressed responses", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [
        compressionMiddleware({ threshold: 64, encodings: ["gzip"] }),
        staleContentLengthMiddleware,
      ],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/large-json", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Content-Length")).toBeNull();

    const compressed = Buffer.from(await response.arrayBuffer());
    const decoded = gunzipSync(compressed).toString("utf-8");

    expect(JSON.parse(decoded)).toEqual({ payload: LARGE_PAYLOAD });
  });

  it("leaves responses below the threshold unchanged", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 1024, encodings: ["gzip"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/small-json", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBeNull();
    await expect(response.json()).resolves.toEqual({ payload: "small" });
  });

  it("leaves non-compressible content types unchanged", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 1, encodings: ["gzip"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/image", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("leaves error responses uncompressed", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 1, encodings: ["gzip"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/error", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Encoding")).toBeNull();
    await expect(response.text()).resolves.toBe(LARGE_PAYLOAD);
  });

  it("leaves streaming responses uncompressed", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [compressionMiddleware({ threshold: 1, encodings: ["gzip"] })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/stream", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBeNull();
    await expect(response.text()).resolves.toBe(LARGE_PAYLOAD);
  });

  it("leaves downstream replacement responses uncompressed", async () => {
    const app = createApp({
      controllers: [CompressionController],
      middlewares: [
        compressionMiddleware({ threshold: 1, encodings: ["gzip"] }),
        replacementResponseMiddleware,
      ],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/compression/large-json", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      }),
    );

    expect(response.headers.get("Content-Encoding")).toBeNull();
    await expect(response.text()).resolves.toBe(LARGE_PAYLOAD);
  });
});
