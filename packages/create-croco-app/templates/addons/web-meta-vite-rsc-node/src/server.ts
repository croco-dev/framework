import { serve } from "@hono/node-server";
import {
  RenderServer,
  createNodeComposedHandler,
  createRscAssetHandler,
  loadRscBuild,
} from "@croco/meta-vite";

const port = Number(process.env["PORT"] ?? 3000);
const hostname = process.env["HOST"] ?? "127.0.0.1";
const publicOrigin = process.env["PUBLIC_ORIGIN"];

// A wildcard address is not an origin any client sends, so it needs the public one.
if (publicOrigin === undefined && (hostname === "0.0.0.0" || hostname === "::")) {
  console.error(`Set PUBLIC_ORIGIN to the origin clients use when HOST is ${hostname}.`);
  process.exit(1);
}

// This file runs from `dist/server/server.js`, next to the app's build output.
const build = await loadRscBuild({ outDir: new URL("../", import.meta.url) });
const renderServer = new RenderServer([...build.routes], { build });

// The build renders in a worker; once it stops, exit so the supervisor restarts the server.
void build.closed.then((problem) => {
  console.error(problem.message);
  process.exit(1);
});

let app: { fetch: (request: Request) => Promise<Response> } | undefined;

serve(
  {
    fetch: (request) =>
      app ? app.fetch(request) : Promise.resolve(new Response(null, { status: 503 })),
    port,
    hostname,
  },
  (info) => {
    // Requests for another host are refused, so a client's Host header never
    // chooses the URL a server component sees.
    const host = hostname.includes(":") ? `[${hostname}]` : hostname;
    const origin = publicOrigin ?? `http://${host}:${info.port}`;
    app = createNodeComposedHandler({
      origin,
      apiHandlers: [createRscAssetHandler(build)],
      pageHandler: (request, context) => renderServer.handle(request, context),
    });
    console.log(`listening ${origin}`);
  },
);
