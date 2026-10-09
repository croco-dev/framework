// @croco/meta-vite RSC Flight encoder entry.
//
// This module requires the `react-server` condition
// (`NODE_OPTIONS=--conditions=react-server`, or the Vite `rsc` environment
// configured by `@vitejs/plugin-rsc`). It must never be imported from the
// SSR/HTML runtime (`renderServer.ts`, `ssrCodec.ts`) in the same process:
// under `react-server`, `react-dom/server` throws
// "react-dom/server is not supported in React Server Components".
//
// `RenderServer` runs it in an isolated child process via
// `encodeRscFlightInIsolatedEncoder()` and decodes the resulting Flight
// bytes in this process with the official client decoder.
import { Problem, ProblemCategory } from "@croco/problems-core";
import { createElement } from "react";
import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";

// Lazily resolved inside main() so the SSR/HTML runtime never loads the
// `react-server` encoder module in-process; the encoder runs isolated.
async function loadFlightEncoder(): Promise<{
  renderToReadableStream: (element: unknown, options?: unknown) => ReadableStream<Uint8Array>;
}> {
  return (await import("react-server-dom-webpack/server.node")) as unknown as {
    renderToReadableStream: (element: unknown, options?: unknown) => ReadableStream<Uint8Array>;
  };
}

export class RscEncoderEntryInputProblem extends Problem {
  readonly code = "meta-vite/rsc-encoder-entry-invalid-input";
  readonly category = ProblemCategory.BadRequest;

  constructor(reason: string) {
    super("meta-vite/rsc-encoder-entry-invalid-input", ProblemCategory.BadRequest, reason);
  }
}

type RouteModule = {
  readonly default: React.ComponentType<RenderRouteComponentProps>;
};

async function readRequestBody(signal: AbortSignal): Promise<string> {
  const chunks: Buffer[] = [];
  const stdin = process.stdin;

  stdin.resume();

  for await (const chunk of stdin) {
    if (signal.aborted) {
      break;
    }
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function writeChunk(bytes: Uint8Array): void {
  process.stdout.write(bytes);
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const bodyText = await readRequestBody(controller.signal);
  const body = JSON.parse(bodyText) as { routePath: string; componentRef?: string };
  const routePath = body.routePath;

  if (!routePath || typeof routePath !== "string") {
    throw new RscEncoderEntryInputProblem("rsc encode entry requires a routePath");
  }

  const loaderPath = process.env["CROCO_RSC_COMPONENT_PATH"];
  if (!loaderPath) {
    throw new RscEncoderEntryInputProblem("CROCO_RSC_COMPONENT_PATH is not set");
  }

  const module = (await import(loaderPath)) as RouteModule;
  const request = new Request(`https://rsc-encode.local${routePath}`);
  const element = createElement(module.default, { request });
  const { renderToReadableStream } = await loadFlightEncoder();
  const stream = renderToReadableStream(element) as ReadableStream<Uint8Array>;
  const reader = stream.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    writeChunk(value);
  }
}

// Only run when executed directly as the isolated encoder child process
// (`node dist/libs/rsc/flightEncode.entry.js` with the JSON payload on
// stdin). The package-entrypoint smoke `require()`s every published
// entrypoint and must not trigger the encoder's stdin read + JSON.parse.
const invokedDirectly = process.argv[1] !== undefined && invokedDirectlyAs(process.argv[1]);

function invokedDirectlyAs(argv1: string): boolean {
  return argv1.endsWith("flightEncode.entry.js") || argv1.endsWith("flightEncode.entry.mjs");
}

if (invokedDirectly) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`[croco-rsc-encode] ${message}\n`);
    process.exitCode = 1;
  });
}
