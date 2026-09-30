import { spawn } from "node:child_process";
import { createReadStream, existsSync, promises as fs, statSync } from "node:fs";
import { createServer, request as proxyRequest } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const defaultApiEntry = existsSync(join(appRoot, "apps", "api", "dist", "index.js"))
  ? join(appRoot, "apps", "api", "dist", "index.js")
  : join(appRoot, "apps", "graphql-api", "dist", "index.js");
const apiEntry = process.env.CROCO_API_ENTRY ?? defaultApiEntry;
// Standalone API templates listen on a fixed port (3001 for tRPC, 4000 for
// GraphQL). The gateway binds the container's public port itself and forwards
// API traffic to the child on its own private loopback port, so the child must
// be told a non-conflicting port.
function parsePort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}
const isGraphqlDefault = defaultApiEntry.includes("graphql-api");
let apiPort = parsePort(process.env.CROCO_API_PORT, isGraphqlDefault ? 4000 : 3001);
const publicPort = parsePort(process.env.PORT, isGraphqlDefault ? 4000 : 3001);
// The child must not share the gateway's public port. When both resolve to
// the same port (e.g. platform-injected PORT matching the API default with no
// CROCO_API_PORT override), move the private loopback port aside.
if (apiPort === publicPort) {
  apiPort = publicPort >= 65535 ? publicPort - 1 : publicPort + 1;
}
const spaRoot = process.env.CROCO_SPA_ROOT ?? join(appRoot, "apps", "web", "dist");
const spaIndex = join(spaRoot, "index.html");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendStatus(res, status, body) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

function resolveSpaFile(pathname) {
  const relative = normalize(pathname).replace(/^([/\\])+/, "");
  if (relative === "" || relative.endsWith(sep)) {
    return null;
  }
  const candidate = resolve(spaRoot, relative);
  if (candidate !== spaRoot && !candidate.startsWith(`${spaRoot}${sep}`)) {
    return null;
  }
  try {
    if (statSync(candidate).isFile()) {
      return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

function serveFile(res, filePath, { immutable = false } = {}) {
  const headers = {
    "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=0",
  };
  res.writeHead(200, headers);
  const stream = createReadStream(filePath);
  stream.on("error", () => sendStatus(res, 500, "Failed to read file"));
  stream.pipe(res);
}

function isExplicitApiPath(req, pathname) {
  // GraphQL under /graphql (and / for POST). Route those before static lookup
  // so an API path never falls through to the SPA fallback. Dotted tRPC
  // procedure paths (e.g. /health.check) are checked after static lookup so
  // on-disk files such as /index.html or /favicon.ico win over the API.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return true;
  }
  return pathname === "/graphql" || pathname.startsWith("/api/");
}

function isApiPath(req, pathname) {
  // Static files are resolved before this check, so this only handles paths
  // with no on-disk match. Only single-segment dotted paths (e.g.
  // /health.check) are tRPC GET procedure calls; nested dotted paths (e.g.
  // /users/john.doe) are SPA client-side routes and fall through to index.
  void req;
  return /^\/[^/.]+\.[^/]+$/.test(pathname);
}

function proxyToApi(req, res) {
  const proxy = proxyRequest(
    {
      hostname: "127.0.0.1",
      port: apiPort,
      path: req.url ?? "/",
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${apiPort}` },
    },
    (apiRes) => {
      if (res.headersSent) {
        apiRes.resume();
        return;
      }
      const headers = { ...apiRes.headers };
      delete headers["transfer-encoding"];
      delete headers.connection;
      res.writeHead(apiRes.statusCode ?? 502, headers);
      apiRes.on("error", () => {
        if (!res.headersSent) {
          sendStatus(res, 502, "API unavailable");
          return;
        }
        res.destroy();
      });
      apiRes.pipe(res);
    },
  );
  proxy.on("error", () => sendStatus(res, 502, "API unavailable"));
  req.on("error", () => proxy.destroy());
  req.pipe(proxy);
}

const child = spawn(process.execPath, [apiEntry], {
  env: { ...process.env, PORT: String(apiPort) },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start API child ${apiEntry}: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

const server = createServer((req, res) => {
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    sendStatus(res, 400, "Bad request");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    proxyToApi(req, res);
    return;
  }

  if (isExplicitApiPath(req, pathname)) {
    proxyToApi(req, res);
    return;
  }

  const file = resolveSpaFile(pathname);
  if (file !== null) {
    if (req.method === "HEAD") {
      res.writeHead(200, {
        "content-type": MIME_TYPES[extname(file)] ?? "application/octet-stream",
      });
      res.end();
      return;
    }
    serveFile(res, file, { immutable: pathname.startsWith("/assets/") });
    return;
  }

  if (pathname.startsWith("/assets/")) {
    sendStatus(res, 404, "Not found");
    return;
  }

  if (isApiPath(req, pathname)) {
    proxyToApi(req, res);
    return;
  }

  serveSpaIndex(req, res);
});

function serveSpaIndex(req, res) {
  fs.readFile(spaIndex)
    .then((body) => {
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end();
        return;
      }
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0",
      });
      res.end(body);
    })
    .catch(() => sendStatus(res, 404, "Not found"));
}

server.listen(publicPort, () => {
  console.log(`Serving SPA from ${spaRoot} and proxying API to 127.0.0.1:${apiPort}`);
});
