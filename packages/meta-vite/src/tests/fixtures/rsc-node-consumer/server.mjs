// A consumer server written only against the published package: no workspace
// source paths, no copied negotiation code.
import { serve } from "@hono/node-server";
import {
  RenderServer,
  createNodeComposedHandler,
  createRscAssetHandler,
  loadRscBuild,
} from "@croco/meta-vite";

const build = await loadRscBuild({ outDir: new URL("./dist/", import.meta.url) });
const renderServer = new RenderServer([...build.routes], { build });

let app;
serve(
  {
    fetch: (request) => app.fetch(request),
    port: Number(process.env.PORT ?? 0),
    hostname: "127.0.0.1",
  },
  (info) => {
    const origin = `http://127.0.0.1:${info.port}`;
    app = createNodeComposedHandler({
      origin,
      apiHandlers: [createRscAssetHandler(build)],
      // The tenant is resolved by the server, never read from a client header.
      pageHandler: (request, context) =>
        renderServer.handle(request, { ...context, env: { tenant: "server-tenant" } }),
    });
    console.log(`listening ${origin}`);
  },
);
