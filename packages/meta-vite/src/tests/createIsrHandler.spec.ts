import { describe, expect, it, vi } from "vitest";

import { createIsrHandler } from "../libs/isr/createIsrHandler";
import type { IsrCacheAdapter } from "../libs/isr/types";

describe("createIsrHandler", () => {
  it("reports whether HTML was rendered or served from cache", async () => {
    const cache = new MemoryIsrCacheAdapter();
    const render = vi.fn(async (path: string) => ({ html: `<main>${path}</main>` }));
    const handler = createIsrHandler({ cache, render });

    const first = await handler("/posts");
    const second = await handler("/posts");

    expect(first).toEqual({ html: "<main>/posts</main>", source: "render" });
    expect(second).toEqual({ html: "<main>/posts</main>", source: "cache" });
    expect(render).toHaveBeenCalledOnce();
  });
});

class MemoryIsrCacheAdapter implements IsrCacheAdapter {
  private readonly entries = new Map<string, unknown>();

  async getOrSet<V>(key: string, factory: () => Promise<V>): Promise<V> {
    if (this.entries.has(key)) {
      return this.entries.get(key) as V;
    }

    const value = await factory();
    this.entries.set(key, value);
    return value;
  }

  async invalidate(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
