/**
 * Worker thread that owns one `@vitejs/plugin-rsc` production build.
 *
 * plugin-rsc registers its module loaders on `globalThis` when a built entry
 * loads, so two builds in one thread would resolve each other's client
 * components. Each build therefore loads here, in a thread of its own.
 *
 * This file runs as-is: from TypeScript source in the workspace (Node strips
 * the types) and as `dist/libs/rsc/rscBuildWorker.mjs` when published. It may
 * import only Node builtins and types, never another module of this package.
 */
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";
import type {
  RscHostMessage,
  RscSerializedError,
  RscSerializedRequest,
  RscWorkerData,
  RscWorkerMessage,
  RscWorkerRoute,
} from "./rscBuildProtocol";
import type { RscServerEntry, RscSsrEntry } from "./buildEntry";

type Render = {
  readonly controller: AbortController;
  started: Promise<void>;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
};

type LoadedEntries = {
  readonly server: RscServerEntry;
  readonly ssr: RscSsrEntry;
};

const renders = new Map<number, Render>();

function post(port: MessagePort, message: RscWorkerMessage, transfer: ArrayBuffer[] = []): void {
  port.postMessage(message, transfer);
}

function serializeError(error: unknown): RscSerializedError {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }
  const record = error as Record<string, unknown>;
  return {
    message: typeof record["message"] === "string" ? record["message"] : String(error),
    ...(typeof record["name"] === "string" ? { name: record["name"] } : {}),
    ...(typeof record["code"] === "string" ? { code: record["code"] } : {}),
  };
}

function toRequest(serialized: RscSerializedRequest, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of serialized.headers) {
    headers.append(name, value);
  }
  return new Request(serialized.url, { method: serialized.method, headers, signal });
}

// Must match RSC_INITIAL_FLIGHT_ATTRIBUTE in ./flight; this file cannot import it.
export const FLIGHT_BLOCK_ATTRIBUTE = "data-croco-rsc-flight";
const MACROTASK = Symbol("macrotask");
const FLIGHT_READY = Symbol("flight-ready");
const encoder = new TextEncoder();

// The worker transfers each chunk's ArrayBuffer to the host, and a Buffer may
// be a view into Node's shared pool, so chunks leave here as plain arrays.
function concat(chunks: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(Buffer.concat(chunks));
}

// Flight rows can carry raw bytes (typed arrays, ArrayBuffers), so each block
// carries base64 rather than text that would replace invalid UTF-8. Base64
// has no `<`, so a block cannot close its script element early.
function flightBlock(chunks: readonly Uint8Array[]): Uint8Array {
  const payload = Buffer.concat(chunks).toString("base64");
  return encoder.encode(
    `<script type="application/json" ${FLIGHT_BLOCK_ATTRIBUTE}="chunk">"${payload}"</script>`,
  );
}

const FLIGHT_END_BLOCK = encoder.encode(
  `<script type="application/json" ${FLIGHT_BLOCK_ATTRIBUTE}="end">null</script>`,
);

function nextMacrotask(): Promise<typeof MACROTASK> {
  return new Promise((resolve) => setImmediate(() => resolve(MACROTASK)));
}

/**
 * Writes the Flight bytes a document was rendered from into its HTML while
 * both are still streaming, so the browser can hydrate the shell before late
 * Suspense boundaries resolve.
 *
 * React flushes HTML synchronously, but may split one flush into several
 * chunks at arbitrary byte offsets, including inside a tag. All chunks of one
 * flush are enqueued in the same task, so a read that is still pending once a
 * macrotask has passed marks the end of a flush. Blocks are written only at
 * those boundaries and only after the shell, so they never land inside an
 * element React will hydrate. Merging two flushes into one burst is harmless.
 */
export function interleaveFlight(
  html: ReadableStream<Uint8Array>,
  flight: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const htmlReader = html.getReader();
  const flightReader = flight.getReader();
  let pendingFlight: Uint8Array[] = [];
  let wakeFlight: (() => void) | undefined;
  let nextHtml: Promise<ReadableStreamReadResult<Uint8Array>> | undefined;
  let shellSent = false;
  let htmlDone = false;
  let flightDone = false;

  const flightRead = (async () => {
    for (;;) {
      const { done, value } = await flightReader.read();
      if (done) {
        flightDone = true;
        wakeFlight?.();
        return;
      }
      pendingFlight.push(value);
      wakeFlight?.();
    }
  })();
  // A Flight failure also fails the HTML branch; it is rethrown at the end.
  flightRead.catch(() => undefined);

  const takeFlight = (): Uint8Array[] => {
    if (pendingFlight.length === 0) {
      return [];
    }
    const block = flightBlock(pendingFlight);
    pendingFlight = [];
    return [block];
  };
  const flightArrival = (): Promise<typeof FLIGHT_READY> =>
    new Promise((resolve) => {
      wakeFlight = () => resolve(FLIGHT_READY);
    });
  // A tee branch's cancel settles only once the other branch is cancelled too,
  // and the SSR decoder holds that one, so the Flight side is not awaited.
  // The render's abort signal is what stops the encoder upstream.
  const cancelBoth = async (reason: unknown): Promise<void> => {
    void flightReader.cancel(reason).catch(() => undefined);
    await htmlReader.cancel(reason).catch(() => undefined);
  };
  // The HTML can end before the Flight stream does, for example when a client
  // component receives a promise that SSR never reads. The finished HTML goes
  // out at once; later pulls carry the rest of the payload, then the end block.
  const endHtml = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    head: readonly Uint8Array[],
  ): void => {
    htmlDone = true;
    shellSent = true;
    const bytes = [...head, ...takeFlight()];
    if (bytes.length > 0) {
      controller.enqueue(concat(bytes));
    }
  };
  const pullAfterHtml = async (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> => {
    if (pendingFlight.length === 0 && !flightDone) {
      await flightArrival();
    }
    if (pendingFlight.length > 0) {
      controller.enqueue(concat(takeFlight()));
      return;
    }
    // Rethrows a Flight failure instead of closing a payload that never ended.
    await flightRead;
    controller.enqueue(concat([FLIGHT_END_BLOCK]));
    controller.close();
  };

  const pull = async (controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> => {
    if (htmlDone) {
      await pullAfterHtml(controller);
      return;
    }
    if (shellSent && pendingFlight.length > 0) {
      controller.enqueue(concat(takeFlight()));
      return;
    }
    nextHtml ??= htmlReader.read();
    const first = shellSent ? await Promise.race([nextHtml, flightArrival()]) : await nextHtml;
    if (first === FLIGHT_READY) {
      controller.enqueue(concat(takeFlight()));
      return;
    }
    nextHtml = undefined;
    if (first.done) {
      endHtml(controller, []);
      return;
    }

    const burst = [first.value];
    for (;;) {
      nextHtml = htmlReader.read();
      const next = await Promise.race([nextHtml, nextMacrotask()]);
      if (next === MACROTASK) {
        break;
      }
      nextHtml = undefined;
      if (next.done) {
        endHtml(controller, burst);
        return;
      }
      burst.push(next.value);
    }
    shellSent = true;
    controller.enqueue(concat([...burst, ...takeFlight()]));
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        await pull(controller);
      } catch (error) {
        await cancelBoth(error);
        throw error;
      }
    },
    cancel: cancelBoth,
  });
}

async function importDefault(file: string): Promise<unknown> {
  const module = (await import(pathToFileURL(file).href)) as { default?: unknown };
  return module.default;
}

function isServerEntry(value: unknown, version: string): value is RscServerEntry {
  const entry = value as Partial<Record<keyof RscServerEntry, unknown>> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    entry.version === version &&
    Array.isArray(entry.routes) &&
    typeof entry.renderFlight === "function"
  );
}

function isSsrEntry(value: unknown, version: string): value is RscSsrEntry {
  const entry = value as Partial<Record<keyof RscSsrEntry, unknown>> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    entry.version === version &&
    typeof entry.clientEntryUrl === "string" &&
    typeof entry.renderHtml === "function"
  );
}

async function loadEntries(port: MessagePort, data: RscWorkerData): Promise<LoadedEntries | null> {
  let server: unknown;
  let ssr: unknown;
  try {
    server = await importDefault(data.serverFile);
    ssr = await importDefault(data.ssrFile);
  } catch (error) {
    post(port, {
      type: "failed",
      artifact: server === undefined ? data.serverFile : data.ssrFile,
      reason: `the built entry failed to load: ${serializeError(error).message}`,
    });
    return null;
  }

  if (!isServerEntry(server, data.serverEntryVersion)) {
    post(port, {
      type: "failed",
      artifact: data.serverFile,
      reason:
        "the default export is not created by defineRscServerEntry() from '@croco/meta-vite/rsc/server'",
    });
    return null;
  }
  if (!isSsrEntry(ssr, data.ssrEntryVersion)) {
    post(port, {
      type: "failed",
      artifact: data.ssrFile,
      reason:
        "the default export is not created by defineRscSsrEntry() from '@croco/meta-vite/rsc/ssr'",
    });
    return null;
  }
  return { server, ssr };
}

// `head()` takes no input, so it is read once here and its metadata is sent to
// the host: the function itself cannot cross the thread boundary.
function describeRoutes(server: RscServerEntry): RscWorkerRoute[] {
  return server.routes.map((route) => {
    const head = route.head?.();
    return head ? { path: route.path, head } : { path: route.path };
  });
}

function startRender(
  port: MessagePort,
  entries: LoadedEntries,
  message: Extract<RscHostMessage, { type: "render" }>,
): void {
  const controller = new AbortController();
  const render: Render = { controller, started: Promise.resolve() };
  render.started = openRender(entries, message, render);
  renders.set(message.id, render);

  render.started.then(
    () => {
      if (renders.has(message.id)) {
        post(port, { type: "started", id: message.id });
      } else {
        void render.reader?.cancel("cancelled").catch(() => undefined);
      }
    },
    (error: unknown) => {
      if (renders.delete(message.id)) {
        post(port, { type: "error", id: message.id, error: serializeError(error) });
      }
    },
  );
}

async function openRender(
  entries: LoadedEntries,
  message: Extract<RscHostMessage, { type: "render" }>,
  render: Render,
): Promise<void> {
  const signal = render.controller.signal;
  const flight = entries.server.renderFlight({
    route: message.route,
    request: toRequest(message.request, signal),
    ...(message.context ? { context: message.context } : {}),
    signal,
  });
  if (message.mode === "flight") {
    render.reader = flight.getReader();
    return;
  }
  // One branch becomes HTML; the other is written into that HTML so the
  // browser hydrates from the same bytes the server rendered.
  const [htmlBranch, embedBranch] = flight.tee();
  let html: ReadableStream<Uint8Array>;
  try {
    html = await entries.ssr.renderHtml({ flight: htmlBranch, signal });
  } catch (error) {
    void embedBranch.cancel(error).catch(() => undefined);
    throw error;
  }
  render.reader = interleaveFlight(html, embedBranch).getReader();
}

async function pull(port: MessagePort, id: number): Promise<void> {
  const render = renders.get(id);
  if (!render) {
    return;
  }
  try {
    await render.started;
  } catch {
    // The start failure was already reported to the host by startRender.
    return;
  }
  const reader = render.reader;
  if (!reader || !renders.has(id)) {
    return;
  }

  try {
    const { done, value } = await reader.read();
    if (!renders.has(id)) {
      return;
    }
    if (done) {
      renders.delete(id);
      post(port, { type: "end", id });
      return;
    }
    // React may hand out views into a shared buffer; transferring a copy keeps
    // the original bytes intact for the rest of the render.
    const bytes = value.slice();
    post(port, { type: "chunk", id, bytes }, [bytes.buffer]);
  } catch (error) {
    if (renders.delete(id)) {
      post(port, { type: "error", id, error: serializeError(error) });
    }
  }
}

function cancel(id: number, reason: string): void {
  const render = renders.get(id);
  if (!render) {
    return;
  }
  renders.delete(id);
  render.controller.abort(reason);
  void render.reader?.cancel(reason).catch(() => undefined);
}

async function invokeAction(
  port: MessagePort,
  entries: LoadedEntries,
  message: Extract<RscHostMessage, { type: "action" }>,
): Promise<void> {
  const action = entries.server.actions?.[message.name];
  if (!action) {
    post(port, {
      type: "error",
      id: message.id,
      error: { message: `the build declares no action named '${message.name}'` },
    });
    return;
  }
  try {
    const value = await action(message.input, {
      request: toRequest(message.request, new AbortController().signal),
      ...(message.context ? { context: message.context } : {}),
    });
    post(port, { type: "action-result", id: message.id, value });
  } catch (error) {
    post(port, { type: "error", id: message.id, error: serializeError(error) });
  }
}

async function main(port: MessagePort, data: RscWorkerData): Promise<void> {
  const entries = await loadEntries(port, data);
  if (!entries) {
    return;
  }

  port.on("message", (message: RscHostMessage) => {
    switch (message.type) {
      case "render":
        startRender(port, entries, message);
        return;
      case "pull":
        void pull(port, message.id);
        return;
      case "cancel":
        cancel(message.id, message.reason);
        return;
      case "action":
        void invokeAction(port, entries, message);
        return;
    }
  });
  post(port, {
    type: "ready",
    routes: describeRoutes(entries.server),
    clientEntryUrl: entries.ssr.clientEntryUrl,
    actions: Object.keys(entries.server.actions ?? {}),
  });
}

// Tests import `interleaveFlight` from this file; only a build's worker starts.
if (parentPort && workerData) {
  void main(parentPort, workerData as RscWorkerData);
}
