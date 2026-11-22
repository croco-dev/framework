// Production Node server for the RSC example.
//
// The product path is the public meta-vite adapter: `loadRscBuild` loads the
// `vite build` output, `RenderServer` negotiates HTML and Flight on one path,
// and `createRscAssetHandler` serves the hashed client bundle. Everything else
// in this file is the local performance lab, which stays example-only.
import { serve } from "@hono/node-server";
import {
  RenderServer,
  createNodeComposedHandler,
  createRscAssetHandler,
  loadRscBuild,
} from "@croco/meta-vite";

type LabModule = {
  readonly exposeLab: (
    request: Request,
    input: { receipt: string; displayInstanceId: string; occurredAt: string },
  ) => Promise<void>;
  readonly resetLabCache: () => Promise<void>;
  readonly imagePath: (width: number) => string;
};

type ApiHandler = {
  readonly match: (request: Request) => boolean;
  readonly handle: (request: Request) => Promise<Response>;
};

const port = Number(process.env["PORT"] ?? 4317);
// This file runs from `dist/server/server.js`, next to the app's build output.
const outDir = new URL("../", import.meta.url);
const build = await loadRscBuild({ outDir });
// The lab hooks are named exports of the same rsc module `loadRscBuild` loaded,
// so they share its module state.
const lab = (await import(new URL("rsc/index.js", outDir).href)) as LabModule;

const EXPOSE_FIELDS = ["receipt", "displayInstanceId", "occurredAt"] as const;

let deferredRelease: (() => void) | undefined;
let deferredGate: Promise<void> | undefined;

function route(
  method: string | undefined,
  path: string | ((pathname: string) => boolean),
  handle: (request: Request) => Promise<Response>,
): ApiHandler {
  return {
    match: (request) => {
      const { pathname } = new URL(request.url);
      const pathMatches = typeof path === "string" ? pathname === path : path(pathname);
      return pathMatches && (method === undefined || request.method === method);
    },
    handle,
  };
}

const empty = (status: number, headers?: HeadersInit): Response =>
  new Response(null, { status, ...(headers ? { headers } : {}) });

function parseExposeInput(
  body: string,
): { receipt: string; displayInstanceId: string; occurredAt: string } | null {
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const record = input as Record<string, unknown>;
  const valid =
    EXPOSE_FIELDS.every((key) => typeof record[key] === "string") &&
    Object.keys(record).every((key) => (EXPOSE_FIELDS as readonly string[]).includes(key));
  return valid
    ? {
        receipt: String(record["receipt"]),
        displayInstanceId: String(record["displayInstanceId"]),
        occurredAt: String(record["occurredAt"]),
      }
    : null;
}

function labImage(request: Request): Response {
  const url = new URL(request.url);
  if (![400, 800, 1200].some((width) => url.pathname === lab.imagePath(width))) {
    return empty(404);
  }
  const width = Number(/width=(\d+)/.exec(url.pathname)?.[1] ?? 800);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width * 0.75}" viewBox="0 0 800 600"><rect width="800" height="600" fill="#ede4d1"/><g stroke="#283e65" stroke-width="2" fill="none"><ellipse cx="400" cy="300" rx="250" ry="110" transform="rotate(-30 400 300)"/><ellipse cx="400" cy="300" rx="220" ry="170" transform="rotate(35 400 300)"/><circle cx="400" cy="300" r="65"/></g><circle cx="400" cy="300" r="16" fill="#bb7847"/></svg>`;
  const padding = url.searchParams.has("oversized") ? " ".repeat(150000) : "";
  return new Response(svg + padding, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" },
  });
}

// Local lab control only. No production credentials or shared durable state.
const labHandlers: ApiHandler[] = [
  route("POST", "/lab/defer", async () => {
    deferredGate = new Promise((resolve) => {
      deferredRelease = resolve;
    });
    return empty(204);
  }),
  route("POST", "/lab/resume", async () => {
    deferredRelease?.();
    deferredGate = undefined;
    return empty(204);
  }),
  route(undefined, "/lab/recommendation", async () => {
    await deferredGate;
    return new Response("Saved inspiration");
  }),
  route(undefined, "/lab/blocking-fetch", async () => {
    // Intentional, bounded negative control: a real awaited upstream fetch.
    await new Promise((resolve) => setTimeout(resolve, 1800));
    return new Response("released");
  }),
  route(undefined, "/favicon.ico", async () => empty(204)),
  route("POST", "/lab/expose", async (request) => {
    if (request.headers.get("origin") !== `http://${request.headers.get("host")}`) {
      return empty(403);
    }
    const body = await request.text();
    if (body.length > 8192) {
      return empty(413);
    }
    const input = parseExposeInput(body);
    if (!input) {
      return empty(400);
    }
    try {
      await lab.exposeLab(
        new Request(request.url, { headers: { cookie: request.headers.get("cookie") ?? "" } }),
        input,
      );
    } catch {
      // The lab bridge refuses an unknown or replayed receipt.
      return empty(403);
    }
    return empty(204, { "cache-control": "private, no-store" });
  }),
  route("POST", "/lab/reset", async () => {
    await lab.resetLabCache();
    return empty(204);
  }),
  route(
    undefined,
    (pathname) => pathname.startsWith("/cdn-cgi/imagedelivery/"),
    async (request) => labImage(request),
  ),
];

const renderServer = new RenderServer([...build.routes], { build });

// `PORT=0` picks a free port, so the origin is known only once listening;
// no request can arrive before the listen callback runs.
let app: { fetch: (request: Request) => Promise<Response> } | undefined;
const server = serve(
  {
    fetch: (request) => (app ? app.fetch(request) : Promise.resolve(empty(503))),
    port,
    hostname: "127.0.0.1",
  },
  (info) => {
    app = createNodeComposedHandler({
      origin: `http://127.0.0.1:${info.port}`,
      apiHandlers: [createRscAssetHandler(build), ...labHandlers],
      pageHandler: (request, context) => renderServer.handle(request, context),
    });
    console.log(`[rsc-node-example] listening on http://127.0.0.1:${info.port}`);
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
