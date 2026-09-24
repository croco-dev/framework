import assert from "node:assert/strict";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import { RenderServer, createNodeComposedHandler } from "@croco/meta-vite";
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

const server = new RenderServer([
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
]);
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
  console.log("generated DI SSR request isolation passed");
} finally {
  scope.dispose();
}
