import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import { RscRouteNotInBuildProblem } from "../libs/rsc/buildEntry";
import {
  RSC_CLIENT_MANIFEST_HEADER,
  RSC_INITIAL_FLIGHT_ELEMENT_ID,
  RSC_MANIFEST_ELEMENT_ID,
  readRscInitialFlight,
} from "../libs/rsc/flight";
import { defineRscServerEntry } from "../libs/rsc/serverEntry";
import { defineRscSsrEntry } from "../libs/rsc/ssrEntry";
import type { RenderRouteComponentProps, RenderRouteIR } from "../libs/routes/types";
import type { RuntimeContext } from "../libs/render/types";
import type { RscBuild, RscSsrEntry } from "../libs/rsc/buildEntry";

const MANIFEST_VERSION = "croco.meta-vite.rsc-client-manifest.v1.build-a";
const CLIENT_ENTRY = "/assets/index-abc123.js";

type TenantEnv = { readonly tenant: string };

type FlightSource = {
  readonly signals: AbortSignal[];
  readonly cancelled: unknown[];
};

function streamOf(...rows: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const row of rows) {
        controller.enqueue(encoder.encode(row));
      }
      controller.close();
    },
  });
}

async function textOf(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

// Components return plain text, and the fake encoder writes that text as the
// payload, so a test can read what the server component saw from either
// representation.
function TenantPage(props: RenderRouteComponentProps): string {
  const env = props.context?.env as TenantEnv | undefined;
  return `page:${new URL(props.request.url).pathname}:${env ? `tenant-${env.tenant}` : "no-context"}`;
}

function createBuild(
  source: FlightSource = { signals: [], cancelled: [] },
  overrides: {
    readonly renderHtml?: RscSsrEntry["renderHtml"];
    readonly flight?: (text: string) => ReadableStream<Uint8Array>;
  } = {},
): RscBuild {
  const server = defineRscServerEntry({
    routes: [{ path: "/", component: TenantPage, head: () => ({ title: "Build <Home>" }) }],
    renderToReadableStream: (element, { signal }) => {
      source.signals.push(signal);
      const { type, props } = element as {
        type: (props: RenderRouteComponentProps) => string;
        props: RenderRouteComponentProps;
      };
      const text = type(props);
      const stream = overrides.flight ? overrides.flight(text) : streamOf(`0:"${text}"\n`);
      const reader = stream.getReader();
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        },
        cancel(reason) {
          source.cancelled.push(reason);
          return reader.cancel(reason);
        },
      });
    },
  });
  const ssr = defineRscSsrEntry({
    getClientEntryUrl: () => CLIENT_ENTRY,
    createFromReadableStream: textOf,
    renderToReadableStream: async (node, { signal }) => {
      source.signals.push(signal);
      return streamOf(`<p>${String(node)}</p>`);
    },
  });

  const renderHtml = overrides.renderHtml ?? ssr.renderHtml;

  // Stands in for the build's worker: the same entries, called in process.
  return {
    routes: server.routes.map((route) => ({
      path: route.path,
      mode: "rsc" as const,
      ...(route.head ? { head: route.head } : {}),
      componentLoader: () => Promise.reject(new Error("not loadable")),
    })),
    clientManifestVersion: MANIFEST_VERSION,
    clientEntryUrl: CLIENT_ENTRY,
    clientDir: "/unused",
    actions: [],
    renderFlight: (input) => server.renderFlight(input),
    renderDocument: async (input) => {
      const [htmlBranch, embedBranch] = server.renderFlight(input).tee();
      const embedded = new Response(embedBranch)
        .arrayBuffer()
        .then((buffer) => Buffer.from(buffer).toString("base64"));
      embedded.catch(() => undefined);
      const html = await renderHtml({ flight: htmlBranch, signal: input.signal });
      const reader = html.getReader();
      return {
        html: new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          },
          cancel(reason) {
            source.cancelled.push(reason);
            return reader.cancel(reason);
          },
        }),
        embeddedFlight: () => embedded,
      };
    },
    invokeAction: async () => undefined,
    close: async () => undefined,
    closed: new Promise(() => undefined),
  };
}

function tenantContext(tenant: string): RuntimeContext {
  const env: TenantEnv = { tenant };
  return { platform: "node", env };
}

function flightRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { accept: "text/x-component", [RSC_CLIENT_MANIFEST_HEADER]: MANIFEST_VERSION },
  });
}

describe("RenderServer with a production RSC build", () => {
  it("renders the document from the built ssr entry and embeds the same Flight bytes", async () => {
    const build = createBuild();
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(new Request("http://localhost/"), tenantContext("a"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("vary")).toBe("Accept");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(html).toContain("<title>Build &lt;Home&gt;</title>");
    expect(html).toContain('<div id="root"><p>0:"page:/:tenant-a"\n</p></div>');
    expect(html).toContain(`id="${RSC_MANIFEST_ELEMENT_ID}"`);
    expect(html).toContain(MANIFEST_VERSION);
    expect(html).toContain(`<script type="module" src="${CLIENT_ENTRY}"></script></body>`);

    const embedded = new DOMParserLike(html).getElementById(RSC_INITIAL_FLIGHT_ELEMENT_ID);
    const flight = readRscInitialFlight({ getElementById: () => embedded });
    expect(flight).not.toBeNull();
    expect(await textOf(flight ?? streamOf())).toBe('0:"page:/:tenant-a"\n');
  });

  it("answers a Flight request with the build's manifest version", async () => {
    const build = createBuild();
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(flightRequest("/.rsc"), tenantContext("a"));

    expect(response.status).toBe(200);
    expect(response.headers.get(RSC_CLIENT_MANIFEST_HEADER)).toBe(MANIFEST_VERSION);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe('0:"page:/:tenant-a"\n');
  });

  it("refuses a Flight request from another client build", async () => {
    const build = createBuild();
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(
      new Request("http://localhost/.rsc", {
        headers: { [RSC_CLIENT_MANIFEST_HEADER]: "croco.meta-vite.rsc-client-manifest.v1.old" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "meta-vite/rsc-client-manifest-mismatch" });
  });

  it("passes the request context and keeps concurrent tenants and builds apart", async () => {
    const appA = createBuild();
    const appB = createBuild();
    const serverA = new RenderServer([...appA.routes], { build: appA });
    const serverB = new RenderServer([...appB.routes], { build: appB });

    const bodies = await Promise.all([
      serverA.handle(flightRequest("/.rsc"), tenantContext("a1")).then((r) => r.text()),
      serverB.handle(flightRequest("/.rsc"), tenantContext("b1")).then((r) => r.text()),
      serverA.handle(flightRequest("/.rsc"), tenantContext("a2")).then((r) => r.text()),
      serverB.handle(flightRequest("/.rsc")).then((r) => r.text()),
    ]);

    expect(bodies).toEqual([
      '0:"page:/:tenant-a1"\n',
      '0:"page:/:tenant-b1"\n',
      '0:"page:/:tenant-a2"\n',
      '0:"page:/:no-context"\n',
    ]);
  });

  it("hands the request's abort signal to both the Flight and the HTML render", async () => {
    const source: FlightSource = { signals: [], cancelled: [] };
    const build = createBuild(source);
    const server = new RenderServer([...build.routes], { build });
    const controller = new AbortController();

    await (
      await server.handle(new Request("http://localhost/", { signal: controller.signal }))
    ).text();
    controller.abort();

    expect(source.signals).toHaveLength(2);
    expect(source.signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("cancels the document render when the consumer goes away", async () => {
    const source: FlightSource = { signals: [], cancelled: [] };
    const build = createBuild(source, {
      // The payload never finishes, as with a Suspense boundary that is still
      // waiting, so only a cancel can stop it.
      flight: (text) =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`0:"${text}"\n`));
          },
        }),
      // React streams the shell while a boundary is still pending, so the
      // HTML stays open as well until the consumer leaves.
      renderHtml: async ({ flight }) => {
        const { value } = await flight.getReader().read();
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`<p>${new TextDecoder().decode(value)}</p>`),
            );
          },
        });
      },
    });
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(new Request("http://localhost/"));
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel("navigated-away");

    expect(source.cancelled).toEqual(["navigated-away"]);
  });

  it("reports an ssr render failure as a 500 Problem without leaking its message", async () => {
    const build = createBuild(undefined, {
      renderHtml: async () => {
        throw new Error("secret connection string");
      },
    });
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(new Request("http://localhost/"));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("secret connection string");
  });

  it("refuses a Flight server reference before rendering the build", async () => {
    const source: FlightSource = { signals: [], cancelled: [] };
    const build = createBuild(source);
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(flightRequest("/.rsc?serverReference=action-1"));

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({
      code: "meta-vite/rsc-server-reference-unsupported",
    });
    expect(source.signals).toHaveLength(0);
  });

  it("answers an undeclared path with the existing 404 document", async () => {
    const build = createBuild();
    const server = new RenderServer([...build.routes], { build });

    const response = await server.handle(new Request("http://localhost/missing"));

    expect(response.status).toBe(404);
  });

  it("refuses to start when a host rsc route is missing from the build", () => {
    const build = createBuild();
    const stray: RenderRouteIR = {
      path: "/stray",
      mode: "rsc",
      componentLoader: () => Promise.reject(new Error("not loadable")),
    };

    expect(() => new RenderServer([...build.routes, stray], { build })).toThrow(
      RscRouteNotInBuildProblem,
    );
  });
});

// Enough of a DOM lookup to read one element's text out of the rendered HTML.
class DOMParserLike {
  constructor(private readonly html: string) {}

  getElementById(id: string): { textContent: string | null } | null {
    const match = new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`).exec(this.html);
    return match ? { textContent: match[1] ?? null } : null;
  }
}
