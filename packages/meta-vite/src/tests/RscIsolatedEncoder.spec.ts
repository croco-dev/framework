import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  encodeRscFlightInIsolatedEncoder,
  RscFlightEncodeAbortedProblem,
} from "../libs/rsc/isolatedEncode";
import type { RenderRouteIR } from "../libs/routes/types";

const STUBBED_ENCODER = `// Stays alive without unresolved top-level await: the only way this child
// ends early is the caller's abort signal, which is what these tests cover.
for await (const _chunk of process.stdin) {
  void _chunk;
}
setTimeout(() => {}, 60_000);
`;

const FAILING_ENCODER = `for await (const _chunk of process.stdin) {
  void _chunk;
}
process.stderr.write("encoder fixture failed");
process.exit(3);
`;

describe("isolated RSC encoder lifecycle", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function stubbedEncoderModule(): Promise<string> {
    return writeEncoderModule(STUBBED_ENCODER);
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

  it("kills the encoder child and rejects when the client disconnects", async () => {
    const controller = new AbortController();
    const encoding = encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-abort"),
      request: new Request("https://example.com/rsc-abort", { signal: controller.signal }),
      encoderModule: await stubbedEncoderModule(),
    });

    // Let the child start before aborting so the abort path (not a spawn race)
    // is what stops it.
    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();

    await expect(encoding).rejects.toBeInstanceOf(RscFlightEncodeAbortedProblem);
  }, 10_000);

  it("surfaces a failing encoder as an encode Problem carrying its output", async () => {
    const encoding = encodeRscFlightInIsolatedEncoder({
      route: rscRoute("/rsc-failing"),
      request: new Request("https://example.com/rsc-failing"),
      encoderModule: await failingEncoderModule(),
    });

    await expect(encoding).rejects.toMatchObject({
      code: "meta-vite/rsc-flight-encode-failed",
      status: 500,
      extensions: { route: "/rsc-failing", exitCode: 3, encoderOutput: "encoder fixture failed" },
    });
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
});
