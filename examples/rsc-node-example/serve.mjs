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
import { once } from "node:events";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env["PORT"] ?? 4317);

// Forward a web ReadableStream to a Node response without buffering it to the
// end: the shell and the first rows must be flushed as they are produced.
// `nodeResponse.write()` returning false means the socket buffer is full, so
// wait for `drain` instead of queueing the whole payload in memory.
async function streamBody(stream, nodeResponse) {
  if (!stream) {
    nodeResponse.end();
    return;
  }

  const reader = stream.getReader();

  // The client can disappear mid-stream. Cancelling the reader here propagates
  // upstream, so the Flight render behind it stops instead of producing bytes
  // for a response nobody reads.
  const onClose = () => {
    void reader.cancel().catch(() => {});
  };
  nodeResponse.on("close", onClose);

  try {
    for (;;) {
      if (nodeResponse.destroyed || nodeResponse.writableEnded) {
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!nodeResponse.write(Buffer.from(value))) {
        // A closed response never emits `drain`, so wait for either event
        // instead of hanging on a socket that is already gone.
        await Promise.race([once(nodeResponse, "drain"), once(nodeResponse, "close")]);
      }
    }
  } finally {
    nodeResponse.off("close", onClose);
    reader.releaseLock();
  }
}

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
        // Resolve against the client assets root and verify containment:
        // `%2e%2e`-style encoded segments are not normalized by URL, so a
        // prefix check alone cannot prove the target stays inside assets.
        const assetsRoot = join(here, "dist", "client", "assets");
        const target = join(assetsRoot, decodeURIComponent(url.pathname.slice("/assets/".length)));
        // `join` normalizes encoded `..` segments, so containment is decided by
        // the path relative to the assets root staying inside it. `target` is
        // always absolute (the root is), so it cannot carry that check.
        const rel = relative(assetsRoot, target);
        if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
          nodeResponse.writeHead(404);
          nodeResponse.end("Not Found");
          return;
        }
        const body = await readFile(target);
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

    // Mirror `parseRscFlightRequest` semantics: a Flight fetch sends
    // `Accept: text/x-component` alongside other values, so match with
    // `includes` rather than exact equality (headers may be absent).
    const accept = nodeRequest.headers["accept"];
    const wantsFlight =
      (typeof accept === "string" && accept.includes("text/x-component")) ||
      url.pathname.endsWith(".rsc");

    const flightResponse = await rsc.default(new Request(`http://localhost:${port}/`));

    if (wantsFlight) {
      nodeResponse.writeHead(200, { "content-type": "text/x-component; charset=utf-8" });
      // Stream the Flight bytes straight through: buffering them first would
      // hold back the first rows until the slow server component resolves.
      await streamBody(flightResponse.body, nodeResponse);
      nodeResponse.end();
      return;
    }

    // Pass the encoder's web ReadableStream straight through: the official
    // client decoder requires a web stream with getReader().
    const htmlResponse = await ssr.renderHtml(flightResponse.body);
    nodeResponse.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    // Write the document around the streamed body so the shell and the first
    // HTML rows reach the client before rendering finishes.
    nodeResponse.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>RSC Node Example</title></head><body><div id="root">`,
    );
    await streamBody(htmlResponse.body, nodeResponse);
    nodeResponse.end(
      `</div><script type="module" src="/assets/${clientEntry}"></script></body></html>`,
    );
  } catch (error) {
    console.error(error);
    if (nodeResponse.headersSent) {
      // The shell already went out, so only the connection can be torn down.
      nodeResponse.destroy();
      return;
    }
    nodeResponse.writeHead(500);
    nodeResponse.end("Internal Server Error");
  }
});

httpServer.listen(port, () => {
  console.log(`[rsc-node-example] listening on http://localhost:${port}`);
});
