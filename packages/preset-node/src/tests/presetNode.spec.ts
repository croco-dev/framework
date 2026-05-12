import { serve } from "@hono/node-server";
import { describe, expect, it, vi } from "vitest";

import { createNodeEntry, createNodeServerPreset } from "../index";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn((_options, callback?: () => void) => {
    callback?.();

    return {
      close: vi.fn((closeCallback?: () => void) => closeCallback?.()),
    };
  }),
}));

describe("createNodeServerPreset", () => {
  it("returns a node preset", () => {
    const preset = createNodeServerPreset();

    expect(preset.name).toBe("node");
    expect(preset.config.name).toBe("node");
  });

  it("uses the Node entry point", () => {
    const preset = createNodeServerPreset();

    expect(preset.config.entry).toBe("./entry.js");
  });
});

describe("createNodeEntry", () => {
  it("creates a server lifecycle object", () => {
    const entry = createNodeEntry({ fetch: vi.fn() });

    expect(entry.server).toBeNull();
    expect(typeof entry.start).toBe("function");
    expect(typeof entry.close).toBe("function");
  });

  it("starts the server with node server options", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    const entry = createNodeEntry({ fetch }, { port: 0, hostname: "127.0.0.1" });

    await entry.start();

    expect(serve).toHaveBeenCalledWith(
      {
        fetch,
        port: 0,
        hostname: "127.0.0.1",
      },
      expect.any(Function),
    );
    expect(entry.server).toBeDefined();
  });

  it("uses default node server options", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    const entry = createNodeEntry({ fetch });

    await entry.start();

    expect(serve).toHaveBeenCalledWith(
      {
        fetch,
        port: 3000,
        hostname: "0.0.0.0",
      },
      expect.any(Function),
    );
  });

  it("closes the server lifecycle object", async () => {
    const close = vi.fn((callback?: () => void) => callback?.());
    vi.mocked(serve).mockImplementationOnce((_options, callback) => {
      callback?.({ address: "127.0.0.1", family: "IPv4", port: 3000 });

      return { close } as unknown as ReturnType<typeof serve>;
    });
    const entry = createNodeEntry({ fetch: vi.fn(async () => new Response("ok")) });

    await entry.start();
    await entry.close();

    expect(close).toHaveBeenCalledWith(expect.any(Function));
    expect(entry.server).toBeNull();
  });
});
