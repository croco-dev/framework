import { createElement } from "react";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";

describe("real HTTP shell-first stream", () => {
  it("flushes the shell over a socket before the deferred region resolves", async () => {
    const server = new RenderServer([
      {
        path: "/pdp",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "REAL-SHELL"),
        }),
        regions: [
          {
            id: "reviews",
            loader: async () => {
              await new Promise((resolve) => setTimeout(resolve, 100));
              return "REAL-REGION";
            },
          },
        ],
      },
    ]);

    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/pdp", "http://localhost");
      const response = await server.handle(new Request(url), { platform: "node" });
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (!response.body) {
        res.end();
        return;
      }
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
      }
    });

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    try {
      const address = httpServer.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const response = await fetch(`http://localhost:${port}/pdp`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let prefix = "";
      for (;;) {
        const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
        if (done || !value) break;
        prefix += decoder.decode(value, { stream: true });
        if (prefix.includes("REAL-SHELL")) break;
      }
      let rest = "";
      for (;;) {
        const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
        if (done || !value) break;
        rest += decoder.decode(value, { stream: true });
      }
      rest += decoder.decode(undefined, { stream: false });

      expect(response.status).toBe(200);
      expect(prefix).toContain("REAL-SHELL");
      expect(prefix).not.toContain("REAL-REGION");
      expect(prefix + rest).toContain("REAL-REGION");
      expect(response.headers.get("x-croco-delivery")).toBe("stream; host=node");
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
