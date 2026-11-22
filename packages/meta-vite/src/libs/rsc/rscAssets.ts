import { stat, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { RscBuild } from "./buildEntry";

const ASSET_PREFIX = "/assets/";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

export type RscAssetHandler = {
  readonly match: (request: Request) => boolean;
  readonly handle: (request: Request) => Promise<Response>;
};

/**
 * Serves the hashed client bundle under `/assets/`. Every file name carries a
 * content hash, so responses are cacheable forever. The shape fits the
 * `apiHandlers` of `createNodeComposedHandler`.
 */
export function createRscAssetHandler(build: Pick<RscBuild, "clientDir">): RscAssetHandler {
  const assetsDir = join(build.clientDir, "assets");

  return {
    match: (request) =>
      (request.method === "GET" || request.method === "HEAD") &&
      new URL(request.url).pathname.startsWith(ASSET_PREFIX),
    handle: async (request) => {
      const file = resolveAssetFile(assetsDir, new URL(request.url).pathname);
      if (file === null || !(await isFile(file))) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = {
        "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      };
      return new Response(request.method === "HEAD" ? null : await readFile(file), { headers });
    },
  };
}

// URL parsing leaves percent-encoded `..` segments alone, so containment is
// decided on the decoded, joined path rather than on the URL prefix.
function resolveAssetFile(assetsDir: string, pathname: string): string | null {
  let name: string;
  try {
    name = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
  } catch {
    return null;
  }

  const file = join(assetsDir, name);
  const fromAssets = relative(assetsDir, file);
  if (fromAssets === "" || fromAssets === ".." || fromAssets.startsWith(`..${sep}`)) {
    return null;
  }
  return file;
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    // A missing or unreadable path is answered as 404 by the caller.
    return false;
  }
}
