import type { Redis } from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisCacheStoreAdapter } from "../libs/isr/adapters/redisAdapter";
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

  beforeEach(() => {
    pipelineDelMock = vi.fn().mockReturnThis();
    pipelineExecMock = vi.fn().mockResolvedValue([]);
    pipelineMock = {
      del: pipelineDelMock,
      exec: pipelineExecMock,
    };

    mockStreamOn.mockReset();
    mockStreamOn.mockImplementation(() => {});

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
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
      expect(mockRedis.get).toHaveBeenCalledWith("isr:/test");
    });

    it("returns Response on hit", async () => {
      const cached = {
        status: 200,
        headers: { "content-type": "text/html" },
        body: "<h1>Hello</h1>",
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

      expect(mockRedis.setex).toHaveBeenCalledWith("isr:/test", 60, expect.any(String));
      const serialized = String(vi.mocked(mockRedis.setex).mock.calls[0]?.[2]);
      const parsed = JSON.parse(serialized);
      expect(parsed.status).toBe(200);
      expect(parsed.body).toBe("<h1>Hello</h1>");
    });

    it("uses SET without TTL", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await adapter._set("/test", new Response("Hello"));

      expect(mockRedis.set).toHaveBeenCalledWith("isr:/test", expect.any(String));
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it("ttlMs=0 uses set(), not setex()", async () => {
      vi.mocked(mockRedis.set).mockResolvedValue("OK");

      await adapter._set("/test", new Response("no-ttl"), 0);

      expect(mockRedis.set).toHaveBeenCalledWith("isr:/test", expect.any(String));
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe("_delete", () => {
    it("deletes the prefixed key", async () => {
      vi.mocked(mockRedis.del).mockResolvedValue(1);

      await adapter._delete("/test");

      expect(mockRedis.del).toHaveBeenCalledWith("isr:/test");
    });
  });

  describe("getOrSet", () => {
    it("returns cached response on hit", async () => {
      const cached = { status: 200, headers: {}, body: "cached" };
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
      const cached = { status: 200, headers: {}, body: "fetched-1" };
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

      expect(mockRedis.scanStream).toHaveBeenCalledWith({ match: "isr:user/*", count: 100 });

      let dataHandler: (keys: string[]) => void | undefined;
      mockStreamOn.mock.calls.forEach((call) => {
        const [event, handler] = call as [string, (...args: unknown[]) => void];
        if (event === "data") {
          dataHandler = handler as (keys: string[]) => void;
        }
      });
      dataHandler!(["isr:user/1", "isr:user/2"]);
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
