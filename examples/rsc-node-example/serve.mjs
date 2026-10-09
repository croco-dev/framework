// Production Node server for the RSC example.
//
// Uses the real `vite build` outputs:
// - `dist/rsc/index.js`   — official Flight encoder (`renderToReadableStream`)
// - `dist/ssr/index.js`   — official decode + HTML render (`renderHtml`)
// - `dist/client/assets/` — browser bundle with `createFromFetch` hydration
//
// HTML and Flight (`Accept: text/x-component` / `.rsc`) are negotiated on
// one path; the HTML shell is always decoded from the same Flight bytes the
// browser would fetch, so refresh/hydration cannot mix representations.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env["PORT"] ?? 4317);

const rsc = await import("./dist/rsc/index.js");
const ssr = await import("./dist/ssr/index.js");

// Never hardcode a hashed client entry: plugin-rsc emits hashed bundles
// (`index-<hash>.js`) without a `.vite/manifest.json`. Resolve the browser
// entry by scanning `dist/client/assets` so rebuilds keep working.
const assetFiles = await readdir(join(here, "dist", "client", "assets"));
const clientEntry = assetFiles.find((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name));
if (!clientEntry) {
  throw new Error("client bundle index-*.js not found in dist/client/assets");
}

const httpServer = createServer(async (nodeRequest, nodeResponse) => {
  try {
    const url = new URL(nodeRequest.url ?? "/", `http://localhost:${port}`);

    if (url.pathname.startsWith("/assets/")) {
      try {
        const body = await readFile(join(here, "dist", "client", url.pathname));
        nodeResponse.writeHead(200, {
          "content-type": url.pathname.endsWith(".css") ? "text/css" : "application/javascript",
        });
        nodeResponse.end(body);
      } catch {
        nodeResponse.writeHead(404);
        nodeResponse.end("Not Found");
      }
      return;
    }

    const wantsFlight =
      nodeRequest.headers["accept"] === "text/x-component" || url.pathname.endsWith(".rsc");

    const flightResponse = await rsc.default(new Request(`http://localhost:${port}/`));

    if (wantsFlight || !flightResponse.body) {
      const text = await flightResponse.text();
      nodeResponse.writeHead(200, {
        "content-type": "text/x-component; charset=utf-8",
      });
      nodeResponse.end(text);
      return;
    }

    // Pass the encoder's web ReadableStream straight through: the official
    // client decoder requires a web stream with getReader().
    const htmlResponse = await ssr.renderHtml(flightResponse.body);
    const html = await htmlResponse.text();
    nodeResponse.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    nodeResponse.end(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>RSC Node Example</title></head><body><div id="root">${html}</div><script type="module" src="/assets/${clientEntry}"></script></body></html>`,
    );
  } catch (error) {
    console.error(error);
    nodeResponse.writeHead(500);
    nodeResponse.end("Internal Server Error");
  }
});

httpServer.listen(port, () => {
  console.log(`[rsc-node-example] listening on http://localhost:${port}`);
});
