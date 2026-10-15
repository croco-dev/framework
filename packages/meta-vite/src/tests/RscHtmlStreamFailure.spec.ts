import { describe, expect, it, vi } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { PageRouteDefinition } from "../libs/routes/types";

vi.mock("../libs/rsc/ssrCodec", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, createRscSsrCodec: vi.fn() };
});

const { createRscSsrCodec } = await import("../libs/rsc/ssrCodec");

describe("RSC HTML stream failures", () => {
  it("surfaces a render failure that lands after the shell was flushed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createRscSsrCodec).mockResolvedValue({
      decodeFlight: async () => ({}),
      emptyManifest: () => ({ moduleMap: {}, serverModuleMap: {} }),
      renderHtmlStream: async () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("<main>shell</main>"));
          },
          // A Suspense boundary that rejects once the shell has been written:
          // the row is gone, but the failure arrives on the next read.
          pull() {
            return Promise.reject(new Error("boundary render failed"));
          },
        }),
    } as unknown as Awaited<ReturnType<typeof createRscSsrCodec>>);

    const route: PageRouteDefinition = {
      path: "/rsc-html-failure",
      mode: "rsc",
      component: () => null,
    };
    const registry = new RouteRegistry();
    registry.register(defineRoute(route));
    const server = new RenderServer(registry.compile(), {
      encodeFlight: async () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('0:"row"\n'));
            controller.close();
          },
        }),
    });

    const response = await server.handle(new Request("https://example.com/rsc-html-failure"));
    expect(response.status).toBe(200);

    // Reads: the shell prefix, the rendered row, then the failure. The row is
    // still buffered when the source errors, so the rejection surfaces one read
    // later — which is exactly why an unguarded `pull` would be missed.
    const reader = response.body!.getReader();
    expect((await reader.read()).done).toBe(false);
    expect((await reader.read()).done).toBe(false);
    const failure = await reader.read().then(
      () => "ended",
      (error: unknown) => (error as Error).message,
    );
    expect(failure).toBe("boundary render failed");

    // The failure reaches the operator with the route and the cause attached:
    // nothing else records it once the 200 has been committed.
    expect(consoleError).toHaveBeenCalledWith(
      "RSC HTML stream failed",
      expect.objectContaining({ route: "/rsc-html-failure", error: expect.any(Error) }),
    );
  });
});
