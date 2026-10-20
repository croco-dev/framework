import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import schemaSDL from "./schema.graphql?raw";
import { createApi } from "./api";
import { render } from "./render";

/** Local production-build example. It owns only synthetic sessions, no real credentials or storage. */
export async function startServer(port = 0) {
  const api = createApi(schemaSDL);
  const manifest = JSON.parse(
    await readFile(resolve("dist/.vite/manifest.json"), "utf8"),
  ) as Record<string, { file: string }>;
  const browserFile = manifest["src/browser.tsx"].file;
  const server = createServer((request, response) => {
    void (async () => {
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      const url = new URL(request.url ?? "/", origin);
      if (url.pathname.startsWith("/assets/")) {
        // Serve only the manifest entry, never a path derived from the incoming request.
        if (url.pathname !== `/${browserFile}`) {
          response.writeHead(404).end();
          return;
        }
        response.setHeader("content-type", "text/javascript");
        response.end(await readFile(resolve("dist", browserFile)));
        return;
      }
      if (url.pathname === "/session" && request.method === "POST") {
        if (request.headers.origin !== origin) {
          response.writeHead(403).end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const target = Buffer.concat(chunks).toString();
        if (!["bob", "south"].includes(target)) {
          response.writeHead(400).end();
          return;
        }
        response.setHeader(
          "set-cookie",
          `${target === "bob" ? "session=bob" : "tenant=south"}; HttpOnly; SameSite=Strict; Path=/`,
        );
        response.setHeader("content-type", "application/json");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ owner: crypto.randomUUID() }));
        return;
      }
      if (url.pathname === "/graphql" && request.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        const controller = new AbortController();
        response.on("close", () => {
          if (!response.writableFinished) controller.abort();
        });
        const result = await api(
          new Request(url, {
            method: "POST",
            headers,
            body: Buffer.concat(chunks),
            signal: controller.signal,
          }),
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      if (url.pathname !== "/" || request.method !== "GET") {
        response.writeHead(404).end();
        return;
      }
      const cookie = request.headers.cookie ?? "session=alice";
      if (!request.headers.cookie)
        response.setHeader("set-cookie", "session=alice; HttpOnly; SameSite=Strict; Path=/");
      const rendering = new AbortController();
      response.on("close", () => {
        if (!response.writableFinished) rendering.abort();
      });
      const { result, hydration } = await render(
        `${origin}/graphql`,
        cookie,
        crypto.randomUUID(),
        rendering.signal,
      );
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.setHeader("cache-control", "private, no-store");
      response.end(
        `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Apollo SSR</title></head><body><div id="root">${result}</div><script id="apollo-state" type="application/json">${hydration}</script><script type="module" src="/${browserFile}"></script></body></html>`,
      );
    })().catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) response.writeHead(500, { "content-type": "text/plain" });
      response.end("Example request failed");
    });
  });
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await startServer(Number(process.env.PORT ?? 4178));
  console.log(
    `Apollo SSR example: http://127.0.0.1:${(server.address() as { port: number }).port}`,
  );
}
