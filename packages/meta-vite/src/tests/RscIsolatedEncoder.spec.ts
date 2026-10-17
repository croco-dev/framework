import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  encodeRscFlightInIsolatedEncoder,
  RscFlightEncodeAbortedProblem,
} from "../libs/rsc/isolatedEncode";
import type { RenderRouteIR } from "../libs/routes/types";

// `src/tests` lives two directory levels below the package root, which owns the
// manifest the workspace exports map resolves.
const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Stays alive without unresolved top-level await: the only way this child ends
// early is the caller's abort signal, which is what these tests cover.
const STUBBED_ENCODER = `for await (const _chunk of process.stdin) {
  void _chunk;
}
setTimeout(() => {}, 60_000);
`;

// Writes one row, then keeps the boundary open for a while: a caller that waits
// for the child to exit cannot have delivered the first row already.
const CHUNKED_ENCODER = `process.stdout.write("shellrow");
await new Promise((resolve) => setTimeout(resolve, 500));
process.stdout.write("boundary");
`;

// Replays the payload the parent sent, so the test can inspect what a server
// component would receive as its request.
const ECHO_ENCODER = `for await (const chunk of process.stdin) {
  process.stdout.write(chunk);
}
`;

const FAILING_ENCODER = `for await (const _chunk of process.stdin) {
  void _chunk;
}
process.stderr.write("encoder fixture failed");
process.exit(3);
`;

const decoder = new TextDecoder();

describe("isolated RSC encoder lifecycle", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function stubbedEncoderModule(): Promise<string> {
    return writeEncoderModule(STUBBED_ENCODER);
  }

  async function chunkedEncoderModule(): Promise<string> {
    return writeEncoderModule(CHUNKED_ENCODER);
  }

  async function echoEncoderModule(): Promise<string> {
    return writeEncoderModule(ECHO_ENCODER);
  }

  async function failingEncoderModule(): Promise<string> {
    return writeEncoderModule(FAILING_ENCODER);
  }

  async function writeEncoderModule(source: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "croco-rsc-encode-"));
    tempDirs.push(dir);
    const modulePath = join(dir, "encoder.mjs");
    await writeFile(modulePath, source, "utf8");
    return modulePath;
  }

  function rscRoute(path: string): RenderRouteIR {
    // The isolated encoder only reads `path` and `componentRef`; the loader is
    // never invoked because these tests run a stubbed encoder module.
    return {
      path,
      mode: "rsc",
      componentRef: `src/routes${path}.rsc.tsx#default`,
      componentLoader: async () => ({ default: () => null }),
    };
  }

  async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    let text = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return text;
      }
      text += decoder.decode(value, { stream: true });
    }
  }

  async function collectWithArrivals(stream: ReadableStream<Uint8Array>): Promise<{
    text: string;
    arrivals: number[];
  }> {
    const startedAt = Date.now();
    const arrivals: number[] = [];
    const reader = stream.getReader();
    let text = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      arrivals.push(Date.now() - startedAt);
      text += decoder.decode(value, { stream: true });
    }

    return { text, arrivals };
  }

  it("refuses a runtime context it cannot carry into the child process", async () => {
    // A server component reading a host value renders `undefined` if the
    // context is dropped on the floor, so refuse before spawning instead.
    await expect(
      encodeRscFlightInIsolatedEncoder({
        route: rscRoute("/rsc-context"),
        request: new Request("https://example.com/rsc-context"),
        encoderModule: await stubbedEncoderModule(),
        context: { platform: "cloudflare", env: { SECRET: "value" } },
      }),
    ).rejects.toMatchObject({
      code: "meta-vite/rsc-flight-context-unsupported",
      status: 500,
      extensions: { route: "/rsc-context", platform: "cloudflare" },
    });
  });

  it("delivers encoder rows before the child process exits", async () => {
    const stream = await encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-streaming"),
      request: new Request("https://example.com/rsc-streaming"),
      encoderModule: await chunkedEncoderModule(),
    });

    const { text, arrivals } = await collectWithArrivals(stream);

    expect(text).toBe("shellrowboundary");
    // The fixture writes the second row half a second after the first, so a
    // caller that waits for the child to exit would see one merged chunk
    // arriving once. Two chunks with the fixture's own gap between them can
    // only mean stdout was relayed while the child was still rendering.
    expect(arrivals).toHaveLength(2);
    expect(arrivals[1] - arrivals[0]).toBeGreaterThanOrEqual(400);
  }, 10_000);

  it("forwards the caller's request to the encoder child", async () => {
    const stream = await encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-request"),
      request: new Request("https://example.com/rsc-request?locale=ko", {
        headers: { cookie: "session=abc", "x-tenant": "class101" },
      }),
      encoderModule: await echoEncoderModule(),
    });

    const payload = JSON.parse(await collect(stream)) as {
      routePath: string;
      componentRef?: string;
      request?: { url: string; method: string; headers: Record<string, string> };
    };

    expect(payload.routePath).toBe("/rsc-request");
    expect(payload.componentRef).toBe("src/routes/rsc-request.rsc.tsx#default");
    expect(payload.request?.url).toBe("https://example.com/rsc-request?locale=ko");
    expect(payload.request?.method).toBe("GET");
    expect(payload.request?.headers).toMatchObject({
      cookie: "session=abc",
      "x-tenant": "class101",
    });
  }, 10_000);

  it("kills the encoder child and fails the stream when the client disconnects", async () => {
    const controller = new AbortController();
    const stream = await encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-abort"),
      request: new Request("https://example.com/rsc-abort", { signal: controller.signal }),
      encoderModule: await stubbedEncoderModule(),
    });

    // Let the child start before aborting so the abort path (not a spawn race)
    // is what stops it.
    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();

    await expect(collect(stream)).rejects.toBeInstanceOf(RscFlightEncodeAbortedProblem);
  }, 10_000);

  it("rejects immediately when the request was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      encodeRscFlightInIsolatedEncoder({
        route: rscRoute("/rsc-preaborted"),
        request: new Request("https://example.com/rsc-preaborted", { signal: controller.signal }),
        encoderModule: await stubbedEncoderModule(),
      }),
    ).rejects.toBeInstanceOf(RscFlightEncodeAbortedProblem);
  }, 10_000);

  it("surfaces a failing encoder as an encode Problem carrying its output", async () => {
    const stream = await encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-failing"),
      request: new Request("https://example.com/rsc-failing"),
      encoderModule: await failingEncoderModule(),
    });

    await expect(collect(stream)).rejects.toMatchObject({
      code: "meta-vite/rsc-flight-encode-failed",
      status: 500,
      extensions: { route: "/rsc-failing", exitCode: 3, encoderOutput: "encoder fixture failed" },
    });
  }, 10_000);

  it("rejects an uninstalled encoder entry before spawning a child", async () => {
    await expect(
      encodeRscFlightInIsolatedEncoder({
        route: rscRoute("/rsc-missing-entry"),
        request: new Request("https://example.com/rsc-missing-entry"),
        encoderModule: join(tmpdir(), "croco-rsc-encoder-not-installed", "encoder.mjs"),
      }),
    ).rejects.toMatchObject({
      code: "meta-vite/rsc-flight-encode-failed",
      status: 500,
      extensions: { route: "/rsc-missing-entry", exitCode: null },
    });
  });

  it("stops the encoder when the consumer cancels the response stream", async () => {
    const stream = await encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-cancelled"),
      request: new Request("https://example.com/rsc-cancelled"),
      encoderModule: await stubbedEncoderModule(),
    });

    await stream.cancel();

    // A cancelled stream never produces rows, and the child it was feeding is
    // torn down rather than left rendering until the encode timeout.
    await expect(collect(stream)).resolves.toBe("");
  }, 10_000);
});

// A workspace consumer resolves the encoder through the package's own exports
// map, so an `exports` entry that omits the manifest makes every deep path
// unresolvable and pushes the spawn onto a cwd-dependent heuristic. This
// keeps the documented chain intact.
describe("workspace encoder module resolution", () => {
  const consumerRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      consumerRoots
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 })),
    );
  });

  it("resolves the encoder entry from the installed package manifest", async () => {
    const consumerRoot = await mkdtemp(join(tmpdir(), "croco-rsc-encoder-consumer-"));
    consumerRoots.push(consumerRoot);
    await writeFile(
      join(consumerRoot, "package.json"),
      `${JSON.stringify({ name: "croco-rsc-encoder-consumer", private: true }, null, 2)}\n`,
      "utf8",
    );
    // A workspace consumer sees the package through `node_modules`, so the
    // exports map that governs resolution is the workspace manifest's.
    await mkdir(join(consumerRoot, "node_modules", "@croco"), { recursive: true });
    await symlink(packageRoot, join(consumerRoot, "node_modules", "@croco", "meta-vite"), "dir");

    const anchor = createRequire(join(consumerRoot, "package.json"));
    const manifestPath = anchor.resolve("@croco/meta-vite/package.json");
    const entryPath = join(dirname(manifestPath), "dist", "libs", "rsc", "flightEncode.entry.js");

    expect(entryPath.startsWith(packageRoot)).toBe(true);
    expect(existsSync(entryPath)).toBe(true);
  });
});
