import type { AddressInfo } from "node:net";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import type { NodeEntry } from "../entry";
import { createNodeEntry } from "../index";

let entry: NodeEntry | null = null;

afterEach(async () => {
  await entry?.close();
  entry = null;
});

function getServerPort(server: NodeEntry["server"]): number {
  const address = server?.address();

  expect(address).not.toBeNull();
  expect(typeof address).toBe("object");

  return (address as AddressInfo).port;
}

describe("createNodeEntry E2E", () => {
  it("starts a server and handles HTTP requests", async () => {
    const app = new Hono();
    app.get("/test", (c) => c.json({ status: "ok" }));
    entry = createNodeEntry({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });

    await entry.start();
    const port = getServerPort(entry.server);

    const response = await fetch(`http://127.0.0.1:${port}/test`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  }, 10000);

  it("rejects when another server uses the same port", async () => {
    const app = new Hono();
    app.get("/test", (c) => c.text("ok"));
    entry = createNodeEntry({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });

    await entry.start();
    const port = getServerPort(entry.server);
    const conflictingEntry = createNodeEntry({ fetch: app.fetch }, { port, hostname: "127.0.0.1" });

    await expect(conflictingEntry.start()).rejects.toThrow();
    await conflictingEntry.close();
  }, 10000);
});
