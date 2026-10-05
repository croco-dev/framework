import "reflect-metadata";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { serve } from "@hono/node-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp as createCrocoApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn((_options: unknown, callback?: () => void) => {
    callback?.();
    return {};
  }),
}));

const OUTSIDE_ROOT_SENTINEL = "outside-root-secret";

type StaticFixture = {
  readonly directory: string;
  readonly outsideFileName: string;
  cleanup(): Promise<void>;
};

type StaticResponseContract = {
  readonly path: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly cacheControl: string | null;
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly bodyKind: string;
  readonly leakedOutsideRootSentinel: boolean;
};

function createApp(config: Parameters<typeof createCrocoApp>[0]) {
  return createCrocoApp({ securityValidation: "off", diValidation: "off", ...config });
}

async function createStaticFixture(files: Record<string, string>): Promise<StaticFixture> {
  const directory = await mkdtemp(join(tmpdir(), "croco-static-conformance-"));
  const outsideFilePath = `${directory}-outside.txt`;

  await Promise.all(
    Object.entries(files).map(async ([filePath, contents]) => {
      const absolutePath = join(directory, filePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents);
    }),
  );
  await writeFile(outsideFilePath, OUTSIDE_ROOT_SENTINEL);

  return {
    directory,
    outsideFileName: basename(outsideFilePath),
    async cleanup() {
      await Promise.all([
        rm(directory, { recursive: true, force: true }),
        rm(outsideFilePath, { force: true }),
      ]);
    },
  };
}

async function createStaticApp(files: Record<string, string>, spaFallback = true) {
  const app = createApp({ controllers: [] });
  const fixture = await createStaticFixture(files);

  await app.listen(3000, { staticDir: fixture.directory, spaFallback });

  return { app, fixture };
}

async function readStaticResponseContract(
  path: string,
  response: Response,
): Promise<StaticResponseContract> {
  const body = await response.text();

  return {
    path: normalizePathForSnapshot(path),
    status: response.status,
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
    etag: response.headers.get("etag") === null ? null : "<etag>",
    lastModified: response.headers.get("last-modified") === null ? null : "<last-modified>",
    bodyKind: classifyBody(body),
    leakedOutsideRootSentinel: body.includes(OUTSIDE_ROOT_SENTINEL),
  };
}

function normalizePathForSnapshot(path: string): string {
  return path.replace(
    /croco-static-conformance-[^/]+-outside\.txt/g,
    "<outside-root-sentinel>.txt",
  );
}

function classifyBody(body: string): string {
  if (body.includes('console.log("asset app")')) {
    return "asset:app-js";
  }
  if (body.includes('<svg data-icon="logo"')) {
    return "asset:nested-svg";
  }
  if (body.includes("<main>spa shell</main>")) {
    return "spa:index-html";
  }
  if (body.includes("404")) {
    return "transport:not-found";
  }
  return "transport:empty";
}

describe("Static asset and SPA fallback conformance", () => {
  beforeEach(() => {
    Container.reset();
    vi.mocked(serve).mockClear();

    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: vi.fn(),
      child: () => logger,
    } as unknown as Logger;

    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  afterEach(() => {
    vi.mocked(serve).mockClear();
  });

  it("serves normal and nested static assets with conditional-request headers", async () => {
    const { app, fixture } = await createStaticApp({
      "index.html": "<html><body><main>spa shell</main></body></html>",
      "assets/app.js": 'console.log("asset app");',
      "assets/icons/logo.svg": '<svg data-icon="logo" viewBox="0 0 1 1"></svg>',
    });

    try {
      const first = await app.fetch(new Request("http://localhost/assets/app.js"));
      const etag = first.headers.get("etag");
      const lastModified = first.headers.get("last-modified");

      expect(etag).toBeTruthy();
      expect(lastModified).toBeTruthy();
      expect(first.headers.get("cache-control")).toBe("public, max-age=3600");

      const conditional = await app.fetch(
        new Request("http://localhost/assets/app.js", {
          headers: { "if-none-match": etag ?? "*" },
        }),
      );

      expect(conditional.status).toBe(304);
      expect(await conditional.text()).toBe("");

      const modifiedSince = await app.fetch(
        new Request("http://localhost/assets/app.js", {
          headers: { "if-modified-since": lastModified ?? new Date().toUTCString() },
        }),
      );

      expect(modifiedSince.status).toBe(304);

      const contracts = await Promise.all(
        ["/assets/app.js", "/assets/icons/logo.svg"].map(async (path) =>
          readStaticResponseContract(path, await app.fetch(new Request(`http://localhost${path}`))),
        ),
      );

      expect(contracts).toMatchInlineSnapshot(`
        [
          {
            "bodyKind": "asset:app-js",
            "cacheControl": "public, max-age=3600",
            "contentType": "text/javascript; charset=utf-8",
            "etag": "<etag>",
            "lastModified": "<last-modified>",
            "leakedOutsideRootSentinel": false,
            "path": "/assets/app.js",
            "status": 200,
          },
          {
            "bodyKind": "asset:nested-svg",
            "cacheControl": "public, max-age=3600",
            "contentType": "image/svg+xml; charset=utf-8",
            "etag": "<etag>",
            "lastModified": "<last-modified>",
            "leakedOutsideRootSentinel": false,
            "path": "/assets/icons/logo.svg",
            "status": 200,
          },
        ]
      `);
    } finally {
      await fixture.cleanup();
    }
  });

  it("serves SPA fallback with no-cache policy and conditional requests", async () => {
    const { app, fixture } = await createStaticApp({
      "index.html": "<html><body><main>spa shell</main></body></html>",
    });

    try {
      const first = await app.fetch(
        new Request("http://localhost/dashboard", {
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
      );
      const etag = first.headers.get("etag");

      expect(first.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
      expect(etag).toBeTruthy();

      const conditional = await app.fetch(
        new Request("http://localhost/dashboard", {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "if-none-match": etag ?? "*",
          },
        }),
      );

      expect(conditional.status).toBe(304);
      expect(await conditional.text()).toBe("");
    } finally {
      await fixture.cleanup();
    }
  });

  it("streams large static assets without changing conditional-request headers", async () => {
    const { app, fixture } = await createStaticApp({
      "index.html": "<html><body><main>spa shell</main></body></html>",
      "assets/large.js": `${'console.log("large asset");\n'.repeat(100)}`,
    });

    try {
      const small = await app.fetch(new Request("http://localhost/assets/large.js"));
      expect(small.status).toBe(200);

      const streamedApp = createApp({ controllers: [] });
      await streamedApp.listen(3000, {
        staticDir: fixture.directory,
        spaFallback: true,
        staticStreamThresholdBytes: 1,
      });
      const streamed = await streamedApp.fetch(new Request("http://localhost/assets/large.js"));
      const etag = streamed.headers.get("etag");

      expect(streamed.status).toBe(200);
      expect(etag).toBeTruthy();
      expect(await streamed.text()).toContain("large asset");

      const conditional = await streamedApp.fetch(
        new Request("http://localhost/assets/large.js", {
          headers: { "if-none-match": etag ?? "*" },
        }),
      );

      expect(conditional.status).toBe(304);
      expect(await conditional.text()).toBe("");
    } finally {
      await fixture.cleanup();
    }
  });

  it("serves HEAD for static assets and SPA fallback without a body", async () => {
    const { app, fixture } = await createStaticApp({
      "index.html": "<html><body><main>spa shell</main></body></html>",
      "assets/app.js": 'console.log("asset app");',
    });

    try {
      const getResponse = await app.fetch(new Request("http://localhost/assets/app.js"));
      const headResponse = await app.fetch(
        new Request("http://localhost/assets/app.js", { method: "HEAD" }),
      );

      expect(headResponse.status).toBe(200);
      expect(await headResponse.text()).toBe("");
      expect(headResponse.headers.get("etag")).toBe(getResponse.headers.get("etag"));
      expect(headResponse.headers.get("last-modified")).toBe(
        getResponse.headers.get("last-modified"),
      );
      expect(headResponse.headers.get("cache-control")).toBe(
        getResponse.headers.get("cache-control"),
      );
      expect(headResponse.headers.get("content-length")).toBe(
        (await getResponse.text()).length.toString(),
      );

      const fallbackHead = await app.fetch(
        new Request("http://localhost/dashboard", {
          method: "HEAD",
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
      );

      expect(fallbackHead.status).toBe(200);
      expect(await fallbackHead.text()).toBe("");
      expect(fallbackHead.headers.get("etag")).toBeTruthy();
      expect(fallbackHead.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps SPA fallback cache independent from the asset cache override", async () => {
    const app = createApp({ controllers: [] });
    const fixture = await createStaticFixture({
      "index.html": "<html><body><main>spa shell</main></body></html>",
      "assets/app.js": 'console.log("asset app");',
    });

    await app.listen(3000, {
      staticDir: fixture.directory,
      spaFallback: true,
      staticCacheControl: "public, max-age=31536000, immutable",
    });

    try {
      const asset = await app.fetch(new Request("http://localhost/assets/app.js"));
      const fallback = await app.fetch(
        new Request("http://localhost/dashboard", {
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
      );

      expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(fallback.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    } finally {
      await fixture.cleanup();
    }
  });

  it("locks missing asset and SPA fallback routing contracts", async () => {
    const { app, fixture } = await createStaticApp({
      "index.html": "<html><body><main>spa shell</main></body></html>",
      "assets/app.js": 'console.log("asset app");',
    });

    try {
      const requests = [
        new Request("http://localhost/dashboard", {
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
        new Request("http://localhost/assets/missing.js", {
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
        new Request("http://localhost/dashboard", {
          headers: { Accept: "application/json" },
        }),
      ];
      const contracts = await Promise.all(
        requests.map(async (request) =>
          readStaticResponseContract(new URL(request.url).pathname, await app.fetch(request)),
        ),
      );

      expect(contracts).toMatchInlineSnapshot(`
        [
          {
            "bodyKind": "spa:index-html",
            "cacheControl": "public, max-age=0, must-revalidate",
            "contentType": "text/html; charset=utf-8",
            "etag": "<etag>",
            "lastModified": "<last-modified>",
            "leakedOutsideRootSentinel": false,
            "path": "/dashboard",
            "status": 200,
          },
          {
            "bodyKind": "transport:not-found",
            "cacheControl": null,
            "contentType": "text/plain; charset=UTF-8",
            "etag": null,
            "lastModified": null,
            "leakedOutsideRootSentinel": false,
            "path": "/assets/missing.js",
            "status": 404,
          },
          {
            "bodyKind": "transport:not-found",
            "cacheControl": null,
            "contentType": "text/plain; charset=UTF-8",
            "etag": null,
            "lastModified": null,
            "leakedOutsideRootSentinel": false,
            "path": "/dashboard",
            "status": 404,
          },
        ]
      `);
    } finally {
      await fixture.cleanup();
    }
  });

  it("blocks decoded and URL-encoded traversal attempts from reading outside the static root", async () => {
    const { app, fixture } = await createStaticApp({
      "index.html": "<html><body><main>spa shell</main></body></html>",
      "assets/app.js": 'console.log("asset app");',
    });
    const decodedTraversalPath = `/assets/..%2f..%2f${fixture.outsideFileName}`;
    const encodedTraversalPath = `/assets/%2e%2e%2f%2e%2e%2f${fixture.outsideFileName}`;

    try {
      const requests = [decodedTraversalPath, encodedTraversalPath].map(
        (path) =>
          new Request(`http://localhost${path}`, {
            headers: { Accept: "text/html,application/xhtml+xml" },
          }),
      );
      const contracts = await Promise.all(
        requests.map(async (request) =>
          readStaticResponseContract(new URL(request.url).pathname, await app.fetch(request)),
        ),
      );

      expect(contracts).toMatchInlineSnapshot(`
        [
          {
            "bodyKind": "transport:not-found",
            "cacheControl": null,
            "contentType": "text/plain; charset=UTF-8",
            "etag": null,
            "lastModified": null,
            "leakedOutsideRootSentinel": false,
            "path": "/assets/..%2f..%2f<outside-root-sentinel>.txt",
            "status": 404,
          },
          {
            "bodyKind": "transport:not-found",
            "cacheControl": null,
            "contentType": "text/plain; charset=UTF-8",
            "etag": null,
            "lastModified": null,
            "leakedOutsideRootSentinel": false,
            "path": "/assets/%2e%2e%2f%2e%2e%2f<outside-root-sentinel>.txt",
            "status": 404,
          },
        ]
      `);
    } finally {
      await fixture.cleanup();
    }
  });
});
