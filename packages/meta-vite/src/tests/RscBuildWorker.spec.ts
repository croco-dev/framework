import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RSC_SERVER_ENTRY_VERSION, RSC_SSR_ENTRY_VERSION } from "../libs/rsc/buildEntry";
import {
  RSC_CLIENT_BUILD_FILE,
  RSC_FLIGHT_VERSION,
  composeRscClientManifestVersion,
  readRscInitialFlight,
} from "../libs/rsc/flight";
import { loadRscBuild } from "../libs/rsc/loadRscBuild";
import { RscFlightEncodeAbortedProblem } from "../libs/rsc/isolatedEncode";
import { RscBuildValueUnsupportedProblem } from "../libs/rsc/plainData";
import {
  RscBuildActionNotFoundProblem,
  RscBuildWorkerFailedProblem,
  RscBuildWorkerUnavailableProblem,
} from "../libs/rsc/rscBuildWorkerClient";
import type { RscBuild, RscRenderRequest } from "../libs/rsc/buildEntry";

// Plain ESM entries with the shape the helpers produce. Module state counts
// what happened inside the worker, and the `state` action reads it back.
const SERVER_ENTRY = `const state = { renders: 0, aborted: 0 };
const encoder = new TextEncoder();
export default {
  version: ${JSON.stringify(RSC_SERVER_ENTRY_VERSION)},
  routes: [{ path: "/", head: () => ({ title: "Worker" }) }, { path: "/pending" }, { path: "/slow-shell" }, { path: "/binary" }],
  renderFlight({ route, request, context, signal }) {
    state.renders += 1;
    signal.addEventListener("abort", () => { state.aborted += 1; });
    if (route === "/binary") {
      return new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0x30, 0x3a, 0xff, 0xfe, 0x00, 0x0a])); controller.close(); } });
    }
    if (route === "/slow-shell") {
      return new ReadableStream({ start() {} });
    }
    if (route === "/pending") {
      return new ReadableStream({ start(controller) { controller.enqueue(encoder.encode("0:pending\\n")); } });
    }
    const line = "0:" + new URL(request.url).pathname + ":" + (context?.env?.tenant ?? "none") + ":" + (request.headers.get("x-request") ?? "") + "\\n";
    return new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(line)); controller.close(); } });
  },
  actions: {
    state: () => ({ renders: state.renders, aborted: state.aborted }),
    echo: (input, { request, context }) => ({ input, url: request.url, tenant: context?.env?.tenant ?? null }),
    fail: () => { throw new Error("secret detail"); },
    crash: () => { process.exit(3); },
  },
};`;

const SSR_ENTRY = `const encoder = new TextEncoder();
export default {
  version: ${JSON.stringify(RSC_SSR_ENTRY_VERSION)},
  clientEntryUrl: "/assets/index-abc123.js",
  async renderHtml({ flight }) {
    const { value } = await flight.getReader().read();
    const text = new TextDecoder().decode(value).trim();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("<p>" + text + "</p>"));
        if (!text.includes("pending")) controller.close();
      },
    });
  },
};`;

let root!: string;
let builds: RscBuild[] = [];

async function loadFakeBuild(name: string): Promise<RscBuild> {
  const dir = join(root, name);
  mkdirSync(join(dir, "client", "assets"), { recursive: true });
  mkdirSync(join(dir, "rsc"), { recursive: true });
  mkdirSync(join(dir, "ssr"), { recursive: true });
  writeFileSync(
    join(dir, "client", RSC_CLIENT_BUILD_FILE),
    JSON.stringify({
      flightVersion: RSC_FLIGHT_VERSION,
      clientBuildId: "abc123",
      clientManifestVersion: composeRscClientManifestVersion("abc123"),
    }),
  );
  writeFileSync(join(dir, "client", "assets", "index-abc123.js"), "export {};");
  writeFileSync(join(dir, "rsc", "index.js"), SERVER_ENTRY);
  writeFileSync(join(dir, "ssr", "index.js"), SSR_ENTRY);
  const build = await loadRscBuild({ outDir: dir });
  builds.push(build);
  return build;
}

function renderInput(
  route: string,
  init: { tenant?: string; signal?: AbortSignal } = {},
): RscRenderRequest {
  return {
    route,
    request: new Request(`http://localhost${route}`, { headers: { "x-request": "r1" } }),
    ...(init.tenant ? { context: { platform: "node", env: { tenant: init.tenant } } } : {}),
    signal: init.signal ?? new AbortController().signal,
  };
}

async function textOf(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

async function workerState(build: RscBuild): Promise<{ renders: number; aborted: number }> {
  return (await build.invokeAction("state", null, {
    request: new Request("http://localhost/"),
  })) as { renders: number; aborted: number };
}

async function eventually(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(await check()).toBe(true);
}

describe("RSC build worker", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "croco-rsc-worker-"));
    builds = [];
  });

  afterEach(async () => {
    await Promise.all(builds.map((build) => build.close()));
    rmSync(root, { force: true, recursive: true });
  });

  it("renders Flight and documents in the worker with the request and plain context", async () => {
    const build = await loadFakeBuild("app");

    expect(build.routes.map((route) => [route.path, route.head?.()])).toEqual([
      ["/", { title: "Worker" }],
      ["/pending", undefined],
      ["/slow-shell", undefined],
      ["/binary", undefined],
    ]);
    expect(await textOf(build.renderFlight(renderInput("/", { tenant: "a" })))).toBe("0:/:a:r1\n");

    const document = await build.renderDocument(renderInput("/", { tenant: "b" }));
    expect(await textOf(document.html)).toBe("<p>0:/:b:r1</p>");
    expect(Buffer.from(await document.embeddedFlight(), "base64").toString()).toBe("0:/:b:r1\n");
  });

  it("embeds Flight bytes that are not valid UTF-8 without changing them", async () => {
    const build = await loadFakeBuild("app");
    const document = await build.renderDocument(renderInput("/binary"));
    await textOf(document.html);

    const embedded = await document.embeddedFlight();
    const stream = readRscInitialFlight({
      getElementById: () => ({ textContent: JSON.stringify(embedded) }),
    });

    expect([...new Uint8Array(await new Response(stream).arrayBuffer())]).toEqual([
      0x30, 0x3a, 0xff, 0xfe, 0x00, 0x0a,
    ]);
  });

  it("refuses context that is not plain data instead of cloning it silently", async () => {
    const build = await loadFakeBuild("app");
    const input = {
      ...renderInput("/"),
      context: { platform: "node" as const, env: { lookup: () => "tenant" } },
    };

    expect(() => build.renderFlight(input)).toThrow(RscBuildValueUnsupportedProblem);
    await expect(
      build.renderDocument({ ...input, context: { platform: "node", env: new Map() } }),
    ).rejects.toThrow(RscBuildValueUnsupportedProblem);
  });

  it("stops the render inside the worker when the request aborts", async () => {
    const build = await loadFakeBuild("app");
    const controller = new AbortController();
    const reader = build
      .renderFlight(renderInput("/pending", { signal: controller.signal }))
      .getReader();

    await reader.read();
    controller.abort();

    await eventually(async () => (await workerState(build)).aborted === 1);
  });

  it("settles the caller when the request aborts before the document shell is ready", async () => {
    const build = await loadFakeBuild("app");
    const controller = new AbortController();
    const document = build.renderDocument(
      renderInput("/slow-shell", { signal: controller.signal }),
    );

    controller.abort();

    await expect(document).rejects.toThrow(RscFlightEncodeAbortedProblem);
  });

  it("errors a pending Flight read when the request aborts mid-stream", async () => {
    const build = await loadFakeBuild("app");
    const controller = new AbortController();
    const reader = build
      .renderFlight(renderInput("/pending", { signal: controller.signal }))
      .getReader();
    await reader.read();

    const next = reader.read();
    controller.abort();

    await expect(next).rejects.toThrow(RscFlightEncodeAbortedProblem);
  });

  it("stops the document render inside the worker when the HTML consumer cancels", async () => {
    const build = await loadFakeBuild("app");
    const document = await build.renderDocument(renderInput("/pending"));
    const reader = document.html.getReader();

    await reader.read();
    await reader.cancel("navigated-away");

    await eventually(async () => (await workerState(build)).aborted === 1);
  });

  it("keeps each build's module state in its own worker", async () => {
    const appA = await loadFakeBuild("app-a");
    const appB = await loadFakeBuild("app-b");

    await Promise.all([
      textOf(appA.renderFlight(renderInput("/"))),
      textOf(appA.renderFlight(renderInput("/"))),
      textOf(appB.renderFlight(renderInput("/"))),
    ]);

    expect((await workerState(appA)).renders).toBe(2);
    expect((await workerState(appB)).renders).toBe(1);
  });

  it("fails in-flight renders with a typed Problem when the worker exits, and leaves other builds serving", async () => {
    const crashing = await loadFakeBuild("crashing");
    const healthy = await loadFakeBuild("healthy");
    const pending = crashing.renderFlight(renderInput("/pending")).getReader();
    await pending.read();

    await crashing
      .invokeAction("crash", null, { request: new Request("http://localhost/") })
      .catch(() => undefined);

    await expect(pending.read()).rejects.toThrow(RscBuildWorkerUnavailableProblem);
    expect(await crashing.closed).toBeInstanceOf(RscBuildWorkerUnavailableProblem);
    expect(() => crashing.renderFlight(renderInput("/"))).toThrow(RscBuildWorkerUnavailableProblem);
    expect(await textOf(healthy.renderFlight(renderInput("/")))).toBe("0:/:none:r1\n");
  });

  it("fails renders that are still running when the build is closed", async () => {
    const build = await loadFakeBuild("app");
    const pending = build.renderFlight(renderInput("/pending")).getReader();
    await pending.read();

    await build.close();

    await expect(pending.read()).rejects.toThrow(RscBuildWorkerUnavailableProblem);
  });

  it("runs declared actions with plain input and reports failures without their message", async () => {
    const build = await loadFakeBuild("app");
    const request = new Request("http://localhost/lab");

    expect(build.actions).toEqual(["state", "echo", "fail", "crash"]);
    expect(
      await build.invokeAction(
        "echo",
        { receipt: "r-1" },
        { request, context: { platform: "node", env: { tenant: "a" } } },
      ),
    ).toEqual({ input: { receipt: "r-1" }, url: "http://localhost/lab", tenant: "a" });
    await expect(build.invokeAction("missing", null, { request })).rejects.toThrow(
      RscBuildActionNotFoundProblem,
    );
    const failure = await build
      .invokeAction("fail", null, { request })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RscBuildWorkerFailedProblem);
    expect((failure as RscBuildWorkerFailedProblem).message).not.toContain("secret detail");
    await expect(build.invokeAction("echo", new Date(), { request })).rejects.toThrow(
      RscBuildValueUnsupportedProblem,
    );
  });
});
