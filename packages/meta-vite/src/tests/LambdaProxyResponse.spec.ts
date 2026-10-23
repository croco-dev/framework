import { describe, expect, it } from "vitest";
import { createLambdaComposedHandler, createLambdaHandler } from "../libs/providers/lambda";
import type { CrocoFetchHandler } from "../libs/render/types";

const cookies = [
  "session=abc; HttpOnly; Path=/",
  "theme=dark; Expires=Wed, 21 Oct 2037 07:28:00 GMT",
];
const binary = Uint8Array.from([0, 255, 128, 65, 13, 10]);
const compressed = Uint8Array.from([31, 139, 8, 0, 255, 128, 65]);

function adapt(path: string, handler: CrocoFetchHandler) {
  if (path === "standalone") return createLambdaHandler(handler);
  return createLambdaComposedHandler({
    apiHandlers:
      path === "API" ? [{ match: () => true, handle: (request) => handler(request) }] : [],
    pageHandler: path === "API" ? async () => new Response("wrong fallback") : handler,
  });
}

function event(version: string) {
  return version === "2.0"
    ? { version, rawPath: "/", rawQueryString: "", requestContext: { http: { method: "GET" } } }
    : { version, path: "/", httpMethod: "GET" };
}

describe.each(["standalone", "API", "page"])("Lambda proxy %s", (path) => {
  describe.each(["1.0", "2.0"])("payload %s", (version) => {
    it.each([
      {
        name: "HTML",
        response: () =>
          new Response("<h1>안녕</h1>", {
            status: 201,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
        status: 201,
        body: "<h1>안녕</h1>",
        base64: false,
      },
      {
        name: "JSON",
        response: () => Response.json({ created: 7 }, { status: 202 }),
        status: 202,
        body: '{"created":7}',
        base64: false,
      },
      {
        name: "redirect",
        response: () => new Response(null, { status: 303, headers: { location: "/next?item=7" } }),
        status: 303,
        body: "",
        base64: false,
      },
      {
        name: "no content",
        response: () => new Response(null, { status: 204 }),
        status: 204,
        body: "",
        base64: false,
      },
      {
        name: "binary",
        response: () =>
          new Response(binary, { headers: { "content-type": "application/octet-stream" } }),
        status: 200,
        body: "AP+AQQ0K",
        base64: true,
      },
      {
        name: "compressed JSON",
        response: () =>
          new Response(compressed, {
            headers: { "content-type": "application/json", "content-encoding": "gzip" },
          }),
        status: 200,
        body: "H4sIAP+AQQ==",
        base64: true,
      },
      {
        name: "invalid UTF-8 text",
        response: () => new Response(binary, { headers: { "content-type": "text/plain" } }),
        status: 200,
        body: "AP+AQQ0K",
        base64: true,
      },
    ])("serializes $name without losing response semantics", async (test) => {
      const source = test.response();
      source.headers.set("x-trace", "trace-73");
      for (const cookie of cookies) source.headers.append("set-cookie", cookie);
      const result = JSON.parse(
        JSON.stringify(await adapt(path, async () => source)(event(version), {})),
      );
      expect(result).toMatchObject({
        statusCode: test.status,
        body: test.body,
        isBase64Encoded: test.base64,
        headers: { "x-trace": "trace-73" },
      });
      expect(result.headers["set-cookie"]).toBeUndefined();
      if (version === "2.0") {
        expect(result.cookies).toEqual(cookies);
        expect(result.multiValueHeaders).toBeUndefined();
      } else {
        expect(result.multiValueHeaders).toEqual({ "set-cookie": cookies });
        expect(result.cookies).toBeUndefined();
      }
      if (source.headers.has("content-type"))
        expect(result.headers["content-type"]).toBe(source.headers.get("content-type"));
      if (test.name === "redirect") expect(result.headers.location).toBe("/next?item=7");
      if (test.name === "compressed JSON") expect(result.headers["content-encoding"]).toBe("gzip");
    });

    it("rejects when buffering the response body fails", async () => {
      const failure = new Error("body read failed");
      const source = new Response(
        new ReadableStream({
          start(controller) {
            controller.error(failure);
          },
        }),
      );
      await expect(adapt(path, async () => source)(event(version), {})).rejects.toBe(failure);
    });

    it("keeps callback completion pending until the body has been consumed", async () => {
      const body = Promise.withResolvers<Uint8Array>();
      const reading = Promise.withResolvers<void>();
      const source = new Response(
        new ReadableStream({
          async pull(controller) {
            reading.resolve();
            controller.enqueue(await body.promise);
            controller.close();
          },
        }),
      );
      let completed = false;
      const pending = adapt(path, async () => source)(event(version), {}).then((result) => {
        completed = true;
        return result;
      });
      await reading.promise;
      await Promise.resolve();
      expect(completed).toBe(false);
      body.resolve(new TextEncoder().encode("complete body"));
      expect(JSON.parse(JSON.stringify(await pending)).body).toBe("complete body");
    });
  });
});
