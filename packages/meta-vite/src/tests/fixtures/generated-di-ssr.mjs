import assert from "node:assert/strict";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import {
  MetaViteUnsupportedCapabilityProblem,
  RenderServer,
  createMetaViteRouteManifest,
  createMetaViteRouteManifestFromRegistry,
  createNodeComposedHandler,
} from "@croco/meta-vite";
import { setImmediate } from "node:timers/promises";
import { createElement } from "react";

const disposed = [];
class RequestService {
  requestId = Context.getRequestId();

  [Symbol.dispose]() {
    disposed.push(this.requestId);
  }
}

const graph = defineGeneratedDiGraph({
  version: GENERATED_DI_GRAPH_VERSION,
  graphId: "packed-ssr",
  compilerVersion: "test",
  inputHash: "packed-ssr",
  roots: [RequestService],
  providers: [
    {
      token: RequestService,
      tokenId: "app:RequestService",
      debugName: "RequestService",
      scope: "request",
      dependencies: [],
      factory: () => new RequestService(),
      sourceLocation: { file: "src/RequestService.ts", line: 1, column: 1 },
    },
  ],
});
const scope = Container.createScope();
scope.run(() => Container.installGeneratedGraph(graph));

const loaderStarted = Promise.withResolvers();
const loaderRelease = Promise.withResolvers();
function flightStream(text) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
const bufferedRoute = {
  path: "/buffered",
  mode: "rsc",
  componentRef: "src/Buffered.tsx#Buffered",
  componentLoader: async () => {
    loaderStarted.resolve();
    await loaderRelease.promise;
    return { default: () => createElement("main", null, "Complete buffered content") };
  },
};
const renderFailure = new Error("private renderer failure");
const server = new RenderServer(
  [
    bufferedRoute,
    ...["ssr", "rsc"].map((mode) => ({
      path: `/${mode}-failure`,
      mode,
      componentLoader: async () => {
        throw renderFailure;
      },
    })),
    {
      path: "/page",
      mode: "ssr",
      componentLoader: async () => ({
        default: ({ context }) => {
          const service = Container.get(RequestService);
          assert.equal(Container.get(RequestService), service);
          return createElement("main", null, `${service.requestId}:${context.platform}`);
        },
      }),
    },
  ],
  {
    // Real Flight path in the packed consumer: encode official Flight bytes
    // per route instead of embedding an HTML-JSON payload disguised as Flight.
    // The `/buffered` encoder preserves the loader-gating contract (the HTML
    // shell still awaits the complete component); `/rsc-failure` surfaces the
    // redacted render failure.
    encodeFlight: async (route) => {
      if (route.path === "/buffered") {
        loaderStarted.resolve();
        await loaderRelease.promise;
        return flightStream('0:["$","main",null,{"children":"Complete buffered content"}]\n');
      }
      throw renderFailure;
    },
  },
);
const host = createNodeComposedHandler({
  apiHandlers: [],
  pageHandler: (request, context) =>
    scope.run(() =>
      Context.run({ requestId: request.headers.get("x-request-id") }, () =>
        server.handle(request, context),
      ),
    ),
});

try {
  const responses = await Promise.all(
    ["first", "second"].map((requestId) =>
      host.fetch(
        new Request("https://example.com/page", { headers: { "x-request-id": requestId } }),
      ),
    ),
  );
  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 200);
    assert.match(
      await response.text(),
      new RegExp(`<main>${["first", "second"][index]}:node</main>`),
    );
  }
  assert.deepEqual(disposed.sort(), ["first", "second"]);
  assert.equal(Context.getRequestId(), null);
  const pages = [bufferedRoute];
  const manifest = createMetaViteRouteManifest({
    pages,
    requiredCapabilities: ["fetch", "react-server-components"],
  });
  assert.equal(manifest.pages[0].mode, bufferedRoute.mode);
  assert.deepEqual(manifest.pages[0].runtimeCapabilities, ["fetch", "react-server-components"]);
  const routeRegistry = { getPageRoutes: () => pages, getApiRoutes: () => [] };
  assert.deepEqual(createMetaViteRouteManifestFromRegistry({ routeRegistry }), manifest);
  for (const capability of ["streaming-response"]) {
    for (const createManifest of [
      () => createMetaViteRouteManifest({ pages, requiredCapabilities: [capability] }),
      () =>
        createMetaViteRouteManifestFromRegistry({
          routeRegistry,
          requiredCapabilities: [capability],
        }),
    ]) {
      assert.throws(createManifest, (error) => {
        assert.ok(error instanceof MetaViteUnsupportedCapabilityProblem);
        assert.equal(error.status, 501);
        assert.equal(error.code, "meta-vite/unsupported-render-capability");
        assert.deepEqual(error.extensions, { path: bufferedRoute.path, capability });
        return true;
      });
    }
  }

  let responseDelivered = false;
  const bufferedResponse = host
    .fetch(new Request("https://example.com/buffered"))
    .then((response) => {
      responseDelivered = true;
      return response;
    });
  await loaderStarted.promise;
  await setImmediate();
  assert.equal(responseDelivered, false, "buffered rendering must await the complete component");
  loaderRelease.resolve();
  const response = await bufferedResponse;
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  const html = await response.text();
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.endsWith("</html>"));
  assert.ok(html.includes("<main>Complete buffered content</main>"));
  // Real Flight: official Flight rows travel out-of-band (`text/x-component`),
  // never as an inline `text/x-component` script disguising SSR HTML as Flight.
  assert.ok(!html.includes('type="text/x-component"'));
  assert.ok(html.includes('id="croco-rsc-manifest"'));

  const observedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => observedErrors.push(args);
  try {
    const missing = await host.fetch(new Request("https://example.com/missing"));
    assert.equal(missing.status, 404);
    assert.ok((await missing.text()).includes("<h1>Not Found</h1>"));
    const rscFailure = await host.fetch(new Request("https://example.com/rsc-failure"));
    assert.equal(rscFailure.status, 500);
    assert.equal(rscFailure.headers.get("content-type"), "application/json; charset=utf-8");
    assert.deepEqual(await rscFailure.json(), {
      error: "RSC rendering failed",
      route: "/rsc-failure",
      detail: "An internal server error occurred",
    });
    assert.deepEqual(observedErrors, []);
    const ssrFailure = await host.fetch(new Request("https://example.com/ssr-failure"));
    assert.equal(ssrFailure.status, 500);
    const errorHtml = await ssrFailure.text();
    assert.ok(errorHtml.includes("<h1>Internal Server Error</h1>"));
    assert.ok(!errorHtml.includes(renderFailure.message));
    assert.deepEqual(observedErrors, [
      ["SSR rendering failed", { route: "/ssr-failure", error: renderFailure }],
    ]);
  } finally {
    console.error = originalConsoleError;
  }
  console.log("generated DI SSR request isolation passed");
} finally {
  scope.dispose();
}
