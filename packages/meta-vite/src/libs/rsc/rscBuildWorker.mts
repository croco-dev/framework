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
  embeddedFlight?: Promise<string>;
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

// Flight rows can carry raw bytes (typed arrays, ArrayBuffers), so the payload
// is embedded as base64 rather than as text that would replace invalid UTF-8.
async function readBase64(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks).toString("base64");
    }
    chunks.push(value);
  }
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
  // One branch becomes HTML; the other is embedded after it so the browser
  // hydrates from the same bytes.
  const [htmlBranch, embedBranch] = flight.tee();
  const embeddedFlight = readBase64(embedBranch.getReader());
  embeddedFlight.catch(() => undefined);
  render.embeddedFlight = embeddedFlight;
  const html = await entries.ssr.renderHtml({ flight: htmlBranch, signal });
  render.reader = html.getReader();
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
      const embeddedFlight = render.embeddedFlight ? await render.embeddedFlight : undefined;
      renders.delete(id);
      post(port, {
        type: "end",
        id,
        ...(embeddedFlight === undefined ? {} : { embeddedFlight }),
      });
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

if (parentPort) {
  void main(parentPort, workerData as RscWorkerData);
}
