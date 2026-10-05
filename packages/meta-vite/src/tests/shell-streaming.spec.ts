import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import type { ShellSettleSummary } from "../libs/routes/shell";
import type { RenderRouteComponentProps } from "../libs/routes/types";

function createGate<T = string>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("RenderServer shell streaming", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams the critical shell before a gated deferred region resolves", async () => {
    const gate = createGate<string>();
    let loaderCalls = 0;
    const server = new RenderServer([
      {
        path: "/pdp",
        mode: "ssr",
        componentLoader: async () => ({
          default: ({ regions }: RenderRouteComponentProps) =>
            createElement("main", null, `SHELL tenant=${regions ? "regions" : "none"}`),
        }),
        regions: [
          {
            id: "recommendations",
            loader: () => {
              loaderCalls += 1;
              return gate.promise;
            },
          },
        ],
      },
    ]);

    const response = await server.handle(new Request("https://example.com/pdp"), {
      platform: "node",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-croco-delivery")).toBe("stream; host=node");
    expect(response.headers.get("server-timing")).toContain("shell");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    let prefix = "";
    for (let i = 0; i < 4; i += 1) {
      const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
      if (done) {
        break;
      }
      prefix += decoder.decode(value, { stream: true });
      if (prefix.includes("SHELL")) {
        break;
      }
    }
    expect(prefix).toContain("SHELL");
    expect(prefix).not.toContain("REGION-PAYLOAD");
    expect(loaderCalls).toBeGreaterThan(0);

    gate.resolve("REGION-PAYLOAD");
    let rest = "";
    for (;;) {
      const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
      if (done) {
        break;
      }
      rest += decoder.decode(value, { stream: true });
    }
    rest += decoder.decode(undefined, { stream: false });
    expect(prefix + rest).toContain("REGION-PAYLOAD");
  });

  it("does not apply the buffered byte cap on the stream path", async () => {
    // Contract: `maxBufferedBytes` is a total-response cap for the buffered
    // (Lambda) delivery path only. Stream delivery (node) uses pull-based
    // backpressure (`desiredSize` + `highWaterMark: 1`) with no cumulative
    // cap, so a full-size shell is not cut off mid-stream even when the
    // configured byte bound is small.
    const server = new RenderServer([
      {
        path: "/stream-small-cap",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, `SHELL-${"y".repeat(4096)}`),
        }),
        regions: [{ id: "fast", loader: async () => "REGION-OK" }],
        stream: { maxBufferedBytes: 16 },
        head: () => ({
          title: "Stream Head",
          description: "stream description",
          canonical: "https://example.com/stream-small-cap",
        }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/stream-small-cap"), {
      platform: "node",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-croco-delivery")).toBe("stream; host=node");
    const html = await response.text();
    expect(html).toContain("REGION-OK");
    expect(html.length).toBeGreaterThan(4096);
    // The streamed tree keeps the hydration container and full head metadata
    // that generated meta-vite clients hydrate.
    expect(html).toContain('<div id="root">');
    expect(html).toContain("<title>Stream Head</title>");
    expect(html).toContain('name="description" content="stream description"');
    expect(html).toContain('rel="canonical" href="https://example.com/stream-small-cap"');
  });

  it("commits 404/redirect/critical failure before the first flush", async () => {
    const server = new RenderServer([
      {
        path: "/missing-pdp",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "must not render"),
        }),
        resolveShell: async () => ({ kind: "notFound" }),
      },
      {
        path: "/login-required",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "must not render"),
        }),
        resolveShell: async () => ({ kind: "redirect", location: "/login", status: 302 }),
      },
      {
        path: "/critical-down",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "must not render"),
        }),
        resolveShell: async () => ({ kind: "failed", status: 503 }),
      },
    ]);

    const notFound = await server.handle(new Request("https://example.com/missing-pdp"));
    expect(notFound.status).toBe(404);
    await expect(notFound.text()).resolves.toContain("<title>Not Found</title>");

    const redirect = await server.handle(new Request("https://example.com/login-required"));
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("/login");

    const failed = await server.handle(new Request("https://example.com/critical-down"));
    expect(failed.status).toBe(503);
    await expect(failed.text()).resolves.toContain("Internal Server Error");
  });

  it("keeps after-flush region errors as a safe fallback without stack exposure", async () => {
    const server = new RenderServer([
      {
        path: "/region-error",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "SHELL-OK"),
        }),
        regions: [
          {
            id: "reviews",
            loader: async () => {
              throw new Error("private upstream stack with secret=abc");
            },
          },
        ],
      },
    ]);

    const response = await server.handle(new Request("https://example.com/region-error"), {
      platform: "node",
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("SHELL-OK");
    expect(html).not.toContain("private upstream stack");
    expect(html).not.toContain("secret=abc");
    expect(console.error).toHaveBeenCalledWith(
      "SSR deferred region failed",
      expect.objectContaining({ route: "/region-error", region: "reviews" }),
    );
  });

  it("cancels region work when the client disconnects", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const gate = createGate<string>();
    const release = createGate<void>();
    const server = new RenderServer([
      {
        path: "/cancel",
        mode: "ssr",
        componentLoader: async () => ({
          default: ({ regions }: RenderRouteComponentProps) => {
            observedSignal = regions?.signal;
            return createElement("main", null, "SHELL");
          },
        }),
        regions: [
          {
            id: "slow",
            loader: (input) =>
              gate.promise.then((value) => {
                release.resolve();
                return input?.signal.aborted ? Promise.reject(input.signal.reason) : value;
              }),
          },
        ],
      },
    ]);
    const request = new Request("https://example.com/cancel", { signal: controller.signal });

    const response = await server.handle(request, { platform: "node" });
    const reader = response.body?.getReader();
    const first = await reader?.read();
    expect(first?.done).toBe(false);

    controller.abort(new Error("client disconnect"));
    gate.resolve("late payload");
    await release.promise;

    expect(observedSignal?.aborted).toBe(true);
    await reader?.cancel().catch(() => {});
  });

  it("buffers on lambda and reports the delivery boundary", async () => {
    const gate = createGate<string>();
    const summaries: ShellSettleSummary[] = [];
    const server = new RenderServer([
      {
        path: "/lambda-pdp",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "LAMBDA-SHELL"),
        }),
        regions: [{ id: "addon", loader: () => gate.promise }],
        stream: {
          onSettle: (summary) => {
            summaries.push(summary);
          },
        },
      },
    ]);

    const pending = server.handle(new Request("https://example.com/lambda-pdp"), {
      platform: "lambda",
    });
    gate.resolve("LAMBDA-REGION");
    const response = await pending;

    expect(response.headers.get("x-croco-delivery")).toBe("buffered; host=lambda");
    const html = await response.text();
    expect(html).toContain("LAMBDA-SHELL");
    expect(html).toContain("LAMBDA-REGION");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ delivery: "buffered", regionsSettled: 1 });
  });

  it("isolates concurrent tenants across parallel shell renders", async () => {
    const observedTenants: string[] = [];
    const tenantGates: Record<string, ReturnType<typeof createGate<string>>> = {
      "TENANT-A": createGate<string>(),
      "TENANT-B": createGate<string>(),
    };
    const server = new RenderServer([
      {
        path: "/tenant",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "SHELL"),
        }),
        regions: [
          {
            id: "tenant-region",
            // Context arrives only through the per-request loader input. The
            // loader must not close over a shared variable for tenant data.
            // A gate per tenant keeps both loaders in flight until both have
            // observed their own request headers (no timer ordering).
            loader: (input) => {
              expect(input?.signal?.aborted).toBe(false);
              const tenant = input?.request?.headers.get("x-tenant") ?? "unknown";
              observedTenants.push(tenant);
              tenantGates[tenant]?.resolve(tenant);
              return tenantGates[tenant]?.promise ?? Promise.resolve(tenant);
            },
          },
        ],
      },
    ]);
    const [responseA, responseB] = await Promise.all([
      server.handle(
        new Request("https://example.com/tenant", { headers: { "x-tenant": "TENANT-A" } }),
        {
          platform: "node",
        },
      ),
      server.handle(
        new Request("https://example.com/tenant", { headers: { "x-tenant": "TENANT-B" } }),
        {
          platform: "node",
        },
      ),
    ]);
    const [htmlA, htmlB] = await Promise.all([responseA.text(), responseB.text()]);

    expect(observedTenants.sort()).toEqual(["TENANT-A", "TENANT-B"]);
    expect(htmlA).toContain("TENANT-A");
    expect(htmlA).not.toContain("TENANT-B");
    expect(htmlB).toContain("TENANT-B");
    expect(htmlB).not.toContain("TENANT-A");
  });

  it("fails a slow region on its timeout and keeps shell + settle summary safe", async () => {
    vi.useFakeTimers();
    try {
      const summaries: ShellSettleSummary[] = [];
      const server = new RenderServer([
        {
          path: "/region-timeout",
          mode: "ssr",
          componentLoader: async () => ({
            default: () => createElement("main", null, "SHELL-OK"),
          }),
          regions: [{ id: "slow", loader: () => new Promise(() => {}) }],
          stream: {
            regionTimeoutMs: 50,
            onSettle: (summary) => {
              summaries.push(summary);
            },
          },
        },
      ]);

      const pending = server.handle(new Request("https://example.com/region-timeout"), {
        platform: "node",
      });
      await vi.advanceTimersByTimeAsync(100);
      const response = await pending;
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("SHELL-OK");
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({ regionsFailed: 0, regionsCancelled: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts an oversized buffered response behind the byte bound", async () => {
    const summaries: ShellSettleSummary[] = [];
    const server = new RenderServer([
      {
        path: "/oversized",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, `SHELL-${"x".repeat(2048)}`),
        }),
        regions: [{ id: "fast", loader: async () => "REGION-OK" }],
        stream: {
          maxBufferedBytes: 16,
          onSettle: (summary) => {
            summaries.push(summary);
          },
        },
      },
    ]);

    const response = await server.handle(new Request("https://example.com/oversized"), {
      platform: "lambda",
    });
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Internal Server Error");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      delivery: "buffered",
      timedOut: false,
      abortReason: "max-buffered-bytes",
    });
  });

  it("streams a full-size shell on node without a cumulative byte cap", async () => {
    const server = new RenderServer([
      {
        path: "/full-size",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, `SHELL-${"x".repeat(128 * 1024)}`),
        }),
        regions: [{ id: "fast", loader: async () => "REGION-OK" }],
      },
    ]);

    const response = await server.handle(new Request("https://example.com/full-size"), {
      platform: "node",
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("REGION-OK");
    expect(html.length).toBeGreaterThan(128 * 1024);
  });

  it("aborts the render when the deadline elapses before shell commit", async () => {
    vi.useFakeTimers();
    try {
      const summaries: ShellSettleSummary[] = [];
      const server = new RenderServer([
        {
          path: "/deadline",
          mode: "ssr",
          // Never-resolving loader: the hard deadline race must settle the
          // request without waiting on the loader.
          componentLoader: () => new Promise<never>(() => {}),
          regions: [{ id: "slow", loader: async () => "late payload" }],
          stream: {
            deadlineMs: 10,
            onSettle: (summary) => {
              summaries.push(summary);
            },
          },
        },
      ]);

      const pending = server.handle(new Request("https://example.com/deadline"), {
        platform: "node",
      });
      await vi.advanceTimersByTimeAsync(50);
      const response = await pending;

      expect(response.status).toBe(503);
      await expect(response.text()).resolves.toContain("Service Unavailable");
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({ abortReason: "deadline", shellCommitted: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports client cancellation through the settle summary", async () => {
    const controller = new AbortController();
    const summaries: ShellSettleSummary[] = [];
    const gate = createGate<string>();
    const server = new RenderServer([
      {
        path: "/client-cancel",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "SHELL"),
        }),
        regions: [{ id: "slow", loader: () => gate.promise }],
        stream: {
          onSettle: (summary) => {
            summaries.push(summary);
          },
        },
      },
    ]);

    const response = await server.handle(
      new Request("https://example.com/client-cancel", { signal: controller.signal }),
      { platform: "node" },
    );
    controller.abort(new Error("client disconnect"));
    gate.resolve("late payload");
    await response.body?.cancel().catch(() => {});
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ abortReason: "client-abort" });
  });

  it("cancels slow shell resolution on the deadline and returns 503", async () => {
    let observedSignal: AbortSignal | undefined;
    const server = new RenderServer([
      {
        path: "/slow-shell",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "SHELL"),
        }),
        resolveShell: (input) => {
          observedSignal = input.signal;
          return new Promise<never>((_, reject) => {
            input.signal.addEventListener("abort", () => reject(input.signal.reason), {
              once: true,
            });
          });
        },
        regions: [{ id: "fast", loader: async () => "REGION-OK" }],
        stream: { deadlineMs: 10 },
      },
    ]);

    const response = await server.handle(new Request("https://example.com/slow-shell"), {
      platform: "node",
    });

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toContain("Internal Server Error");
    expect(observedSignal?.aborted).toBe(true);
  });

  it("enforces the shell deadline on a loader that ignores abort", async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const server = new RenderServer([
        {
          path: "/stubborn-shell",
          mode: "ssr",
          componentLoader: async () => ({
            default: () => createElement("main", null, "SHELL"),
          }),
          resolveShell: () =>
            new Promise<never>((resolve) => {
              setTimeout(() => {
                settled = true;
                resolve({ kind: "render" } as never);
              }, 5000);
            }),
          regions: [{ id: "fast", loader: async () => "REGION-OK" }],
          stream: { deadlineMs: 10 },
        },
      ]);

      const pending = server.handle(new Request("https://example.com/stubborn-shell"), {
        platform: "node",
      });
      await vi.advanceTimersByTimeAsync(50);
      const response = await pending;

      expect(response.status).toBe(503);
      expect(settled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits a settle summary when the shell render fails before commit", async () => {
    const summaries: ShellSettleSummary[] = [];
    const server = new RenderServer([
      {
        path: "/broken-shell",
        mode: "ssr",
        componentLoader: async () => {
          throw new Error("boom");
        },
        regions: [{ id: "fast", loader: async () => "REGION-OK" }],
        stream: {
          onSettle: (summary) => {
            summaries.push(summary);
          },
        },
      },
    ]);

    const response = await server.handle(new Request("https://example.com/broken-shell"), {
      platform: "node",
    });

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Internal Server Error");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      shellCommitted: false,
      abortReason: "render-error",
    });
  });

  it("rejects shell streaming fields on non-ssr modes", async () => {
    const { RouteRegistry } = await import("../libs/routes/routeRegistry");
    const registry = new RouteRegistry();

    expect(() =>
      registry.register({
        path: "/static",
        component: (() => createElement("main", null, "STATIC")) as unknown as never,
        mode: "ssg",
        regions: [{ id: "addon", loader: async () => "REGION" }],
      }),
    ).toThrow("requires mode 'ssr'");
  });
});
