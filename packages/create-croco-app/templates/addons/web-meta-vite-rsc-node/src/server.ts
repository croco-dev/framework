import { serve } from "@hono/node-server";
import {
  RenderServer,
  createNodeComposedHandler,
  createRscAssetHandler,
  loadRscBuild,
} from "@croco/meta-vite";

// This file runs from `dist/server/server.js`, next to the app's build output.
const build = await loadRscBuild({ outDir: new URL("../", import.meta.url) });
const renderServer = new RenderServer([...build.routes], { build });
const port = Number(process.env["PORT"] ?? 3000);
const hostname = process.env["HOST"] ?? "127.0.0.1";

let app: { fetch: (request: Request) => Promise<Response> } | undefined;

serve(
  {
    fetch: (request) =>
      app ? app.fetch(request) : Promise.resolve(new Response(null, { status: 503 })),
    port,
    hostname,
  },
  (info) => {
    // PUBLIC_ORIGIN is the origin clients use, so a request's Host header can
    // never choose the URL a server component sees.
    const origin = process.env["PUBLIC_ORIGIN"] ?? `http://${hostname}:${info.port}`;
    app = createNodeComposedHandler({
      origin,
      apiHandlers: [createRscAssetHandler(build)],
      pageHandler: (request, context) => renderServer.handle(request, context),
    });
    console.log(`listening ${origin}`);
  },
);
