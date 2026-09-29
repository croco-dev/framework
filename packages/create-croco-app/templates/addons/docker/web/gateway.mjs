import { spawn } from "node:child_process";
import { createReadStream, existsSync, promises as fs, statSync } from "node:fs";
import { createServer, request as proxyRequest } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..", "..");
const defaultApiEntry = existsSync(join(appRoot, "apps", "api", "dist", "index.js"))
  ? join(appRoot, "apps", "api", "dist", "index.js")
  : join(appRoot, "apps", "graphql-api", "dist", "index.js");
const apiEntry = process.env.CROCO_API_ENTRY ?? defaultApiEntry;
// Standalone API templates listen on a fixed port (3001 for tRPC, 4000 for
// GraphQL). The gateway binds the container's public port itself and forwards
// API traffic to the child on its own private loopback port, so the child must
// be told a non-conflicting port.
const apiPort = Number(process.env.CROCO_API_PORT ?? "3001");
const publicPort = Number(process.env.PORT ?? "3000");
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
  createReadStream(filePath).pipe(res);
}

function isExplicitApiPath(req, pathname) {
  // tRPC serves under /<router>.<procedure>, GraphQL under /graphql (and /
  // for POST). Route those before static lookup so an extension-less API path
  // never falls through to the SPA fallback.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return true;
  }
  return pathname === "/graphql" || pathname.startsWith("/api/");
}

function isApiPath(req, pathname) {
  // Static files are resolved before this check, so any remaining dotted path
  // (e.g. /health.check) is an API call rather than an SPA asset.
  const accept = req.headers.accept ?? "";
  if (accept.includes("application/json") || accept.includes("application/trpc")) {
    return true;
  }
  if (accept.includes("text/html")) {
    return false;
  }
  if (pathname === "/") {
    return false;
  }
  if (req.headers["sec-fetch-dest"] === "document") {
    return false;
  }
  return pathname.includes(".");
}

function proxyToApi(req, res) {
  const proxy = proxyRequest(
    {
      hostname: "127.0.0.1",
      port: apiPort,
      path: req.url ?? "/",
      method: req.method,
      headers: req.headers,
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode ?? 502, apiRes.headers);
      apiRes.pipe(res);
    },
  );
  proxy.on("error", () => sendStatus(res, 502, "API unavailable"));
  req.pipe(proxy);
}

const child = spawn(process.execPath, [apiEntry], {
  env: { ...process.env, PORT: String(apiPort) },
  stdio: "inherit",
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
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;

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
