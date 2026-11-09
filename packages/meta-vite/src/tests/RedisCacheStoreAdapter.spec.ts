import type { Redis } from "ioredis";
import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisCacheStoreAdapter } from "../libs/isr/adapters/redisAdapter";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";
import type { IsrCacheStore } from "../libs/isr/types";

describe("RedisCacheStoreAdapter", () => {
  let mockRedis: Redis;
  let adapter: RedisCacheStoreAdapter;
  let pipelineMock: { del: ReturnType<typeof vi.fn>; exec: ReturnType<typeof vi.fn> };
  let pipelineDelMock: ReturnType<typeof vi.fn>;
  let pipelineExecMock: ReturnType<typeof vi.fn>;
  const mockStreamOn = vi.fn();
  const mockStream = {
    on: mockStreamOn,
  };
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = new Map();
    pipelineDelMock = vi.fn().mockReturnThis();
    pipelineExecMock = vi.fn().mockResolvedValue([]);
    pipelineMock = {
      del: pipelineDelMock,
      exec: pipelineExecMock,
    };

    mockStreamOn.mockReset();
    mockStreamOn.mockImplementation(() => {});

    mockRedis = {
      get: vi.fn(async (key: string) => entries.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        entries.set(key, value);
        return "OK";
      }),
      setex: vi.fn(async (key: string, _ttl: number, value: string) => {
        entries.set(key, value);
        return "OK";
      }),
      del: vi.fn(),
      scanStream: vi.fn(() => mockStream),
      pipeline: vi.fn(() => pipelineMock as unknown as ReturnType<Redis["pipeline"]>),
    } as unknown as Redis;

    adapter = new RedisCacheStoreAdapter(mockRedis);
  });

  it("implements IsrCacheStore contract", () => {
    const store: IsrCacheStore = adapter;
    expect(typeof store.getOrSet).toBe("function");
  });

  describe("_get", () => {
    it("returns undefined when key not found", async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      const result = await adapter._get("/test");
      expect(result).toBeUndefined();
      expect(mockRedis.get).toHaveBeenCalledWith("isr:response-v1:/test");
    });

    it("returns Response on hit", async () => {
      const cached = {
        version: 1,
        status: 200,
        statusText: "OK",
        headers: { "content-type": "text/html" },
        body: "PGgxPkhlbGxvPC9oMT4=",
      };
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cached));

      const result = await adapter._get("/test");
      expect(result).toBeDefined();
      expect(result?.status).toBe(200);
      expect(await result?.text()).toBe("<h1>Hello</h1>");
    });

    it("returns undefined on invalid JSON", async () => {
      vi.mocked(mockRedis.get).mockResolvedValue("not-json");

      const result = await adapter._get("/test");
      expect(result).toBeUndefined();
    });
  });

  describe("_set", () => {
    it("uses SETEX with TTL", async () => {
      vi.mocked(mockRedis.setex).mockResolvedValue("OK");

      await adapter._set(
        "/test",
        new Response("<h1>Hello</h1>", { status: 200, headers: { "content-type": "text/html" } }),
        60000,
      );

      expect(mockRedis.setex).toHaveBeenCalledWith("isr:response-v1:/test", 60, expect.any(String));
      const serialized = String(vi.mocked(mockRedis.setex).mock.calls[0]?.[2]);
      const parsed = JSON.parse(serialized);
      expect(parsed.status).toBe(200);
      expect(parsed.version).toBe(1);
      expect(parsed.body).toBe("PGgxPkhlbGxvPC9oMT4=");
    });

    it("uses SET without TTL", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await adapter._set("/test", new Response("Hello"));

      expect(mockRedis.set).toHaveBeenCalledWith("isr:response-v1:/test", expect.any(String));
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it("ttlMs=0 uses set(), not setex()", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await adapter._set("/test", new Response("no-ttl"), 0);

      expect(mockRedis.set).toHaveBeenCalledWith("isr:response-v1:/test", expect.any(String));
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe("_delete", () => {
    it("deletes the prefixed key", async () => {
      vi.mocked(mockRedis.del).mockResolvedValue(1);

      await adapter._delete("/test");

      expect(mockRedis.del).toHaveBeenCalledWith("isr:response-v1:/test");
    });
  });

  describe("response serialization", () => {
    const binary = Uint8Array.from([0, 255, 254, 253, 128, 1]);
    const utf8 = new TextEncoder().encode("캐시 🐊 café");
    const compressed = new Uint8Array(gzipSync("compressed 캐시 response"));

    const bodyCases: {
      name: string;
      bytes: Uint8Array<ArrayBuffer>;
      headers: Record<string, string>;
    }[] = [
      { name: "UTF-8", bytes: utf8, headers: { "content-type": "text/plain; charset=utf-8" } },
      { name: "binary", bytes: binary, headers: { "content-type": "application/octet-stream" } },
      { name: "compressed", bytes: compressed, headers: { "content-encoding": "gzip" } },
    ];
    it.each(bodyCases)(
      "preserves $name bytes and headers through ISR miss and hit",
      async ({ bytes, headers }) => {
        const render = vi.fn(
          async () =>
            new Response(bytes, {
              status: 200,
              statusText: "Cached",
              headers: {
                ...headers,
                "content-length": String(bytes.byteLength),
                etag: '"original"',
              },
            }),
        );
        const handle = createIsrMiddleware({ cache: adapter, render, ttlMs: 1501 });
        const first = await handle(new Request("https://example.test/data"));
        const second = await handle(new Request("https://example.test/data"));

        for (const response of [first, second]) {
          expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
          expect(response.status).toBe(200);
          expect(response.statusText).toBe("Cached");
          expect(response.headers.get("content-length")).toBe(String(bytes.byteLength));
          expect(response.headers.get("etag")).toBe('"original"');
          for (const [name, value] of Object.entries(headers)) {
            expect(response.headers.get(name)).toBe(value);
          }
        }
        expect(render).toHaveBeenCalledOnce();
        expect(mockRedis.setex).toHaveBeenCalledWith(
          "isr:response-v1:GET:https://example.test/data",
          2,
          expect.any(String),
        );
      },
    );

    it.each([204, 205, 304])("restores status %i with a null body", async (status) => {
      await adapter._set("/empty", new Response(null, { status, headers: { etag: '"empty"' } }));
      const response = await adapter._get("/empty");

      expect(response?.status).toBe(status);
      expect(response?.body).toBeNull();
      expect(response?.headers.get("etag")).toBe('"empty"');
    });

    it("distinguishes an empty body from a null body", async () => {
      await adapter._set("/empty", new Response(""));
      await adapter._set("/null", new Response(null));
      const empty = await adapter._get("/empty");
      const absent = await adapter._get("/null");

      expect(empty?.body).not.toBeNull();
      expect(await empty?.text()).toBe("");
      expect(absent?.body).toBeNull();
      expect(await absent?.text()).toBe("");
    });

    it("isolates legacy readers and writers for custom prefixes without deleting their entries", async () => {
      const legacy = JSON.stringify({ status: 200, headers: {}, body: "legacy" });
      entries.set("custom:/data", legacy);
      const current = new RedisCacheStoreAdapter(mockRedis, "custom:");
      const fetcher = vi.fn(async () => new Response(binary));

      await current.getOrSet("/data", fetcher);
      // An old deployment may continue writing its own key during a rollout.
      entries.set("custom:/data", legacy);
      const response = await current.getOrSet("/data", fetcher);

      expect(new Uint8Array(await response.arrayBuffer())).toEqual(binary);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(entries.get("custom:/data")).toBe(legacy);
      expect(entries.has("custom:response-v1:/data")).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it.each([
      null,
      [],
      {},
      { status: 200, headers: {}, body: "legacy" },
      { version: 2, status: 200, statusText: "", headers: {}, body: "AA==" },
      { version: 1, status: "200", statusText: "", headers: {}, body: "AA==" },
      { version: 1, status: 200, statusText: 7, headers: {}, body: "AA==" },
      { version: 1, status: 200, statusText: "", headers: [], body: "AA==" },
      { version: 1, status: 200, statusText: "", headers: { etag: 7 }, body: "AA==" },
      { version: 1, status: 200, statusText: "", headers: {}, body: { data: "AA==" } },
      { version: 1, status: 200, statusText: "", headers: {}, body: "%%%" },
      { version: 1, status: 200, statusText: "", headers: {}, body: "AB==" },
      { version: 1, status: 200, statusText: "", headers: {}, body: "AA" },
      { version: 1, status: 204, statusText: "", headers: {}, body: "" },
      { version: 1, status: 700, statusText: "", headers: {}, body: null },
      { version: 1, status: 200, statusText: "", headers: { "bad\nname": "value" }, body: "AA==" },
    ])("treats malformed or unsupported entries as misses: %j", async (entry) => {
      entries.set("isr:response-v1:/data", JSON.stringify(entry));
      expect(await adapter._get("/data")).toBeUndefined();
    });

    it("replaces a malformed entry through the normal cache fill", async () => {
      entries.set("isr:response-v1:/data", "not-json");
      const fetcher = vi.fn(async () => new Response(binary));
      await adapter.getOrSet("/data", fetcher);
      const response = await adapter.getOrSet("/data", fetcher);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(binary);
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it("propagates Redis failures rather than treating them as malformed data", async () => {
      const unavailable = new Error("Redis unavailable");
      vi.mocked(mockRedis.get).mockRejectedValue(unavailable);
      await expect(adapter.getOrSet("/data", async () => new Response("fresh"))).rejects.toBe(
        unavailable,
      );
      vi.mocked(mockRedis.set).mockRejectedValue(unavailable);
      await expect(adapter._set("/data", new Response("fresh"))).rejects.toBe(unavailable);
    });
  });

  describe("getOrSet", () => {
    it("returns cached response on hit", async () => {
      const cached = { version: 1, status: 200, statusText: "", headers: {}, body: "Y2FjaGVk" };
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cached));

      let fetcherCalled = false;
      const fetcher = async () => {
        fetcherCalled = true;
        return new Response("fresh");
      };
      const result = await adapter.getOrSet("/test", fetcher);

      expect(await result.text()).toBe("cached");
      expect(fetcherCalled).toBe(false);
    });

    it("calls fetcher and caches on miss", async () => {
      vi.mocked(mockRedis.setex).mockResolvedValue("OK");

      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return new Response(`fetched-${fetchCount}`);
      };

      const result = await adapter.getOrSet("/test", fetcher);

      expect(await result.text()).toBe("fetched-1");
      expect(fetchCount).toBe(1);
    });

    it("caches the fetched value", async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockRedis.setex).mockResolvedValue("OK");

      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return new Response(`fetched-${fetchCount}`);
      };

      await adapter.getOrSet("/test", fetcher);
      const cached = { version: 1, status: 200, statusText: "", headers: {}, body: "ZmV0Y2hlZC0x" };
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cached));

      const second = await adapter.getOrSet("/test", fetcher);
      expect(await second.text()).toBe("fetched-1");
      expect(fetchCount).toBe(1);
    });
  });

  describe("invalidatePattern", () => {
    it("scans and deletes matching keys", async () => {
      let endHandler: () => void;
      mockStreamOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "end") {
          endHandler = handler as () => void;
        }
      });

      const promise = adapter.invalidatePattern("user/*");

      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: "isr:response-v1:user/*",
        count: 100,
      });

      let dataHandler: (keys: string[]) => void | undefined;
      mockStreamOn.mock.calls.forEach((call) => {
        const [event, handler] = call as [string, (...args: unknown[]) => void];
        if (event === "data") {
          dataHandler = handler as (keys: string[]) => void;
        }
      });
      dataHandler!(["isr:response-v1:user/1", "isr:response-v1:user/2"]);
      endHandler!();

      await promise;

      expect(pipelineDelMock).toHaveBeenCalledTimes(2);
      expect(pipelineExecMock).toHaveBeenCalled();
    });

    it("does not exec pipeline when no keys found", async () => {
      let endHandler: () => void;
      mockStreamOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "end") {
          endHandler = handler as () => void;
        }
      });

      const promise = adapter.invalidatePattern("nonexistent/*");
      endHandler!();
      await promise;

      expect(pipelineExecMock).not.toHaveBeenCalled();
    });
  });
});
