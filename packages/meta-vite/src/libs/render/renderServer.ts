import { Suspense, createElement } from "react";
import type { ComponentType, ReactNode } from "react";
import { renderToReadableStream, renderToString } from "react-dom/server";
import {
  RscClientManifestMismatchProblem,
  RscClientReferenceMissingProblem,
  RscFlightNotAcceptableProblem,
  RscServerReferenceNotSupportedProblem,
  assertRscClientManifestVersion,
  assertRscServerReferenceUnsupported,
  createRscFlightHeaders,
  createRscHtmlShell,
  parseRscFlightRequest,
  resolveRscClientManifestVersion,
} from "../rsc/flight";
import { encodeRscFlightInIsolatedEncoder } from "../rsc/isolatedEncode";
import type { RscFlightEncoder, RscRenderOptions } from "../rsc/flight";
import type { RscSsrCodec } from "../rsc/ssrDecode";
import { decodeFlightToHtmlStream } from "../rsc/ssrDecode";
import type { HeadMetadata } from "../routes/head";
import type { ShellDecision, ShellSettleSummary } from "../routes/shell";
import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";
import { createDeferredRegionStore } from "./deferredRegions";
import {
  SHELL_STREAM_DEFAULT_DEADLINE_MS,
  SHELL_STREAM_DEFAULT_MAX_BUFFERED_BYTES,
  SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS,
  ShellStreamAbortedError,
  ShellStreamMaxBufferedBytesError,
  applyShellStreamHeaders,
  resolveShellStreamPolicy,
} from "./shellStream";
import type { ShellStreamPolicy } from "./shellStream";
import type { RuntimeContext } from "./types";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
} as const;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const FALLBACK_HEAD_404: HeadMetadata = {
  title: "Not Found",
  description: "The requested page was not found",
};

const FALLBACK_HEAD_500: HeadMetadata = {
  title: "Internal Server Error",
  description: "An unexpected error occurred",
};

export class RenderServer {
  constructor(
    private readonly routes: RenderRouteIR[],
    private readonly rscOptions: RscRenderOptions = {},
  ) {
    this.rscEncoder = rscOptions.encodeFlight;
    this.rscClientManifestVersion = resolveRscClientManifestVersion(rscOptions);
  }

  private readonly rscEncoder: RscFlightEncoder | undefined;
  private readonly rscClientManifestVersion: string;
  private rscSsrCodecPromise: Promise<RscSsrCodec> | undefined;

  private loadRscSsrCodec(): Promise<RscSsrCodec> {
    this.rscSsrCodecPromise ??= import("../rsc/ssrCodec").then((codec) =>
      codec.createRscSsrCodec(),
    );

    return this.rscSsrCodecPromise;
  }

  async handle(request: Request, context?: RuntimeContext): Promise<Response> {
    const route = this.findRoute(request);

    if (!route) {
      return this.createHtmlResponse("<h1>Not Found</h1>", 404, FALLBACK_HEAD_404);
    }

    if (route.mode === "rsc") {
      return this.handleRsc(route, request, context);
    }

    const startedAt = Date.now();
    const streamOptions = route.stream ?? {};
    const policy = resolveShellStreamPolicy(context?.platform, {
      signal: request.signal,
      deadlineMs: streamOptions.deadlineMs ?? SHELL_STREAM_DEFAULT_DEADLINE_MS,
      regionTimeoutMs: streamOptions.regionTimeoutMs ?? SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS,
      maxBufferedBytes: streamOptions.maxBufferedBytes ?? SHELL_STREAM_DEFAULT_MAX_BUFFERED_BYTES,
    });

    const shellDecision = await this.resolveShellSafely(route, request, context, policy);
    if (shellDecision && shellDecision.kind !== "render") {
      return this.createShellDecisionResponse(shellDecision);
    }

    if (!route.regions || route.regions.length === 0) {
      return this.handleBuffered(route, request, context);
    }

    // One overall deadline budget shared by shell resolution and rendering:
    // subtract the elapsed shell-resolution time (clamped at zero) so a slow
    // resolveShell cannot double the nominal deadline.
    const elapsedMs = Date.now() - startedAt;
    const remainingPolicy: ShellStreamPolicy = {
      ...policy,
      deadlineMs: Math.max(0, policy.deadlineMs - elapsedMs),
    };

    return this.handleShellStream(route, request, context, remainingPolicy);
  }

  private async handleBuffered(
    route: RenderRouteIR,
    request: Request,
    context: RuntimeContext | undefined,
  ): Promise<Response> {
    try {
      const module = await route.componentLoader();
      const props = this.createComponentProps(request, context);
      const html = renderToString(createElement(module.default, props));
      const headMetadata = route.head?.();

      return this.createHtmlResponse(html, 200, headMetadata);
    } catch (error) {
      return this.logAndCreateSafeErrorResponse(error, route.path);
    }
  }

  private async handleShellStream(
    route: RenderRouteIR,
    request: Request,
    context: RuntimeContext | undefined,
    policy: ShellStreamPolicy,
  ): Promise<Response> {
    const streamOptions = route.stream ?? {};

    const controller = new AbortController();
    const reactStreams: Array<ReadableStream<Uint8Array>> = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const forwardRequestAbort = () => {
      controller.abort(
        request.signal.reason instanceof Error
          ? request.signal.reason
          : new ShellStreamAbortedError(request.signal.reason ?? "Client disconnected"),
      );
    };
    if (request.signal.aborted) {
      forwardRequestAbort();
    } else {
      request.signal.addEventListener("abort", forwardRequestAbort, { once: true });
    }
    timers.push(
      setTimeout(
        () => controller.abort(new ShellStreamAbortedError("SSR render deadline exceeded")),
        policy.deadlineMs,
      ),
    );

    const teardown = () => {
      controller.abort(new ShellStreamAbortedError("SSR render teardown"));
      for (const reactStream of reactStreams) {
        void reactStream.cancel(new ShellStreamAbortedError("SSR render teardown")).catch(() => {});
      }
      request.signal.removeEventListener("abort", forwardRequestAbort);
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };

    try {
      // Hard deadline on the loader phase too: a hanging componentLoader
      // must not hold the request past the deadline even if it ignores
      // `signal`. The linked controller still cancels cooperative loaders.
      // On expiry the race throws the linked abort error, which the catch
      // below funnels into the same 503 pre-commit path.
      const deadline = new Promise<never>((_, reject) => {
        if (controller.signal.aborted) {
          reject(toShellAbortError(controller.signal.reason));
        } else {
          controller.signal.addEventListener(
            "abort",
            () => reject(toShellAbortError(controller.signal.reason)),
            { once: true },
          );
        }
      });
      let module: Awaited<ReturnType<RenderRouteIR["componentLoader"]>>;
      module = await Promise.race([route.componentLoader(), deadline]);
      if (controller.signal.aborted) {
        const counts = await createDeferredRegionStore(
          route.regions ?? [],
          controller.signal,
          policy.regionTimeoutMs,
          { request, ...(context ? { context } : {}) },
        ).settle();
        streamOptions.onSettle?.({
          delivery: policy.delivery,
          platform: context?.platform ?? "unknown",
          shellCommitted: false,
          regionsSettled: counts.settled,
          regionsFailed: counts.failed,
          regionsCancelled: counts.cancelled,
          bytes: 0,
          timedOut: this.timedOutFor(controller.signal.reason, request.signal.aborted),
          clientAborted: request.signal.aborted,
          abortReason: this.toAbortReason(controller.signal.reason, request.signal.aborted),
        });
        teardown();
        return this.createHtmlResponse("<h1>Service Unavailable</h1>", 503, FALLBACK_HEAD_500);
      }
      const store = createDeferredRegionStore(
        route.regions ?? [],
        controller.signal,
        policy.regionTimeoutMs,
        { request, ...(context ? { context } : {}) },
      );
      const props = this.createComponentProps(request, context, store.reader);
      // The html shell (doctype/head) wraps the streamed React tree below:
      // renderToReadableStream emits the shell element first, so head metadata
      // commits with the critical shell before deferred regions resolve.
      // The tree keeps the `<div id="root">` container (and full head
      // metadata) that generated meta-vite clients hydrate.
      const head = route.head?.() ?? {};
      const element = createElement(
        "html",
        { lang: "en" },
        createElement(
          "head",
          null,
          createElement("meta", { charSet: "utf-8" }),
          createElement("meta", {
            name: "viewport",
            content: "width=device-width, initial-scale=1",
          }),
          createElement("title", null, head.title),
          ...(head.description
            ? [createElement("meta", { name: "description", content: head.description })]
            : []),
          ...(head.canonical
            ? [createElement("link", { rel: "canonical", href: head.canonical })]
            : []),
        ),
        createElement(
          "body",
          null,
          createElement(
            "div",
            { id: "root" },
            this.withDeferredBoundaries(
              module.default,
              props,
              route.path,
              (route.regions ?? []).map((region) => region.id),
            ),
          ),
        ),
      );

      const stream = await renderToReadableStream(element, { signal: controller.signal });
      reactStreams.push(stream);
      const headers = new Headers(HTML_HEADERS);
      applyShellStreamHeaders(headers, policy.delivery, context?.platform ?? "unknown");

      if (policy.delivery === "buffered") {
        try {
          const body = await this.bufferStream(stream, controller.signal, policy.maxBufferedBytes);
          const counts = await store.settle();
          teardown();
          streamOptions.onSettle?.({
            delivery: "buffered",
            platform: context?.platform ?? "unknown",
            shellCommitted: true,
            regionsSettled: counts.settled,
            regionsFailed: counts.failed,
            regionsCancelled: counts.cancelled,
            bytes: body.byteLength,
            timedOut: false,
            clientAborted: request.signal.aborted,
          });
          return new Response(body.buffer as ArrayBuffer, { status: 200, headers });
        } catch (error) {
          // Abort-before-settle: region loaders observe controller.signal,
          // so abort first to unblock cooperative loaders before settle
          // waits on them. Capture the abort state before teardown because
          // teardown itself aborts the controller.
          const wasAborted = controller.signal.aborted;
          controller.abort(toShellAbortError(error));
          const counts = await store.settle().catch(() => ({
            settled: 0,
            failed: 0,
            cancelled: 0,
          }));
          const clientAborted = request.signal.aborted;
          // Classify explicitly: wasAborted (controller already aborted at
          // catch time) means the deadline timer fired, since teardown has
          // not run yet and a client abort would show in request.signal.
          // Folding wasAborted into the clientAborted flag would misreport
          // a deadline abort as "client-abort".
          let abortReason: ShellSettleSummary["abortReason"];
          if (error instanceof ShellStreamMaxBufferedBytesError) {
            abortReason = "max-buffered-bytes";
          } else if (clientAborted) {
            abortReason = "client-abort";
          } else if (wasAborted || error instanceof ShellStreamAbortedError) {
            abortReason = "deadline";
          } else if (error instanceof Error && error.name === "AbortError") {
            abortReason = "client-abort";
          } else {
            abortReason = "render-error";
          }
          const aborted =
            wasAborted || abortReason === "client-abort" || abortReason === "deadline";
          streamOptions.onSettle?.({
            delivery: "buffered",
            platform: context?.platform ?? "unknown",
            shellCommitted: false,
            regionsSettled: counts.settled,
            regionsFailed: counts.failed,
            regionsCancelled: counts.cancelled,
            bytes: 0,
            timedOut: abortReason === "deadline",
            clientAborted,
            abortReason,
          });
          teardown();
          if (aborted) {
            return this.createHtmlResponse("<h1>Service Unavailable</h1>", 503, FALLBACK_HEAD_500);
          }
          return this.logAndCreateSafeErrorResponse(error, route.path);
        }
      }

      const tracked = this.trackStream(
        stream,
        controller.signal,
        {
          platform: context?.platform ?? "unknown",
          onSettle: streamOptions.onSettle,
          settleRegions: () => store.settle(),
          clientAborted: () => request.signal.aborted,
          onDone: teardown,
        },
        policy.regionTimeoutMs,
      );
      return new Response(tracked, { status: 200, headers });
    } catch (error) {
      // Capture the abort state before teardown: teardown aborts the
      // controller itself, so a post-teardown check would misclassify any
      // render error as a client abort. Non-abort Error reasons from a
      // client disconnect still map to client-abort/503 via toAbortReason.
      const wasAborted = controller.signal.aborted;
      teardown();
      if (error instanceof ShellStreamAbortedError || wasAborted || request.signal.aborted) {
        // Pre-commit deadline/client-abort during the loader phase: same
        // 503 path as the post-loader abort check above.
        const abortReason = this.toAbortReason(error, request.signal.aborted);
        const counts = await createDeferredRegionStore(
          route.regions ?? [],
          controller.signal,
          policy.regionTimeoutMs,
          { request, ...(context ? { context } : {}) },
        ).settle();
        streamOptions.onSettle?.({
          delivery: policy.delivery,
          platform: context?.platform ?? "unknown",
          shellCommitted: false,
          regionsSettled: counts.settled,
          regionsFailed: counts.failed,
          regionsCancelled: counts.cancelled,
          bytes: 0,
          timedOut: abortReason === "deadline",
          clientAborted: request.signal.aborted,
          abortReason,
        });
        return this.createHtmlResponse("<h1>Service Unavailable</h1>", 503, FALLBACK_HEAD_500);
      }
      streamOptions.onSettle?.({
        delivery: policy.delivery,
        platform: context?.platform ?? "unknown",
        shellCommitted: false,
        regionsSettled: 0,
        regionsFailed: 0,
        regionsCancelled: 0,
        bytes: 0,
        timedOut: this.timedOutFor(error, request.signal.aborted),
        clientAborted: request.signal.aborted,
        abortReason: this.toAbortReason(error, request.signal.aborted),
      });
      return this.logAndCreateSafeErrorResponse(error, route.path);
    }
  }

  private withDeferredBoundaries(
    Component: ComponentType<RenderRouteComponentProps>,
    props: RenderRouteComponentProps,
    routePath: string,
    regionIds: readonly string[],
  ): ReactNode {
    if (!props.regions || regionIds.length === 0) {
      return createElement(Component, props);
    }

    const shell = createElement(Component, props);
    // Regions resolve behind Suspense: the shell flushes first while slow
    // loaders settle later. Errors after header commit render the safe
    // fallback and are observed through console.error, never as status edits.
    const regions = regionIds.map((id: string) =>
      createElement(
        Suspense,
        { key: id, fallback: createElement("div", { "data-region": id }) },
        createElement(DeferredRegionOutlet, { id, reader: props.regions, routePath }),
      ),
    );

    return createElement("div", { "data-shell": routePath }, shell, ...regions);
  }

  private async resolveShellSafely(
    route: RenderRouteIR,
    request: Request,
    context: RuntimeContext | undefined,
    policy: ShellStreamPolicy,
  ): Promise<ShellDecision | undefined> {
    if (!route.resolveShell) {
      return undefined;
    }

    // Linked controller: request abort OR shell deadline cancels the loader.
    // The deadline also races the loader promise so a loader that ignores
    // `signal` still settles at the deadline (hard timeout, not only
    // cooperative cancellation).
    const linked = new AbortController();
    const forwardRequestAbort = () => {
      linked.abort(
        request.signal.reason instanceof Error
          ? request.signal.reason
          : new ShellStreamAbortedError(request.signal.reason ?? "Client disconnected"),
      );
    };
    if (request.signal.aborted) {
      forwardRequestAbort();
    } else {
      request.signal.addEventListener("abort", forwardRequestAbort, { once: true });
    }
    const timer = setTimeout(
      () => linked.abort(new ShellStreamAbortedError("SSR shell resolution deadline exceeded")),
      policy.deadlineMs,
    );
    const onDeadline = () =>
      linked.signal.reason instanceof Error
        ? linked.signal.reason
        : new ShellStreamAbortedError("SSR shell resolution deadline exceeded");
    const deadline = new Promise<never>((_, reject) => {
      if (linked.signal.aborted) {
        reject(onDeadline());
      } else {
        linked.signal.addEventListener("abort", () => reject(onDeadline()), { once: true });
      }
    });

    try {
      const decision = await Promise.race([
        route.resolveShell({
          request,
          ...(context ? { context } : {}),
          signal: linked.signal,
        }),
        deadline,
      ]);
      return decision;
    } catch (error) {
      // Classify first: a client disconnect forwards the raw request reason
      // (not always ShellStreamAbortedError), and it must bypass the 500
      // failure report as a 503. Only genuine loader failures are reported
      // and mapped to 500.
      if (
        error instanceof ShellStreamAbortedError ||
        linked.signal.aborted ||
        request.signal.aborted
      ) {
        return { kind: "failed", status: 503 };
      }
      reportShellFailure("SSR shell resolution failed", { route: route.path, error }, route.path);
      return { kind: "failed", status: 500 };
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", forwardRequestAbort);
    }
  }

  private createShellDecisionResponse(
    decision: Exclude<ShellDecision, { kind: "render" }>,
  ): Response {
    switch (decision.kind) {
      case "notFound":
        return this.createHtmlResponse("<h1>Not Found</h1>", 404, FALLBACK_HEAD_404);
      case "redirect": {
        const headers = new Headers(HTML_HEADERS);
        headers.set("location", decision.location);
        return new Response(this.htmlShell(undefined, ""), {
          status: decision.status ?? 302,
          headers,
        });
      }
      case "failed":
        return this.createHtmlResponse(
          "<h1>Internal Server Error</h1>",
          decision.status,
          FALLBACK_HEAD_500,
        );
    }
  }

  private async bufferStream(
    stream: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    maxBufferedBytes: number,
  ): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let bufferedBytes = 0;

    try {
      const aborted = new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(toShellAbortError(signal.reason));
        } else {
          signal.addEventListener("abort", () => reject(toShellAbortError(signal.reason)), {
            once: true,
          });
        }
      });
      for (;;) {
        if (signal.aborted) {
          throw toShellAbortError(signal.reason);
        }
        // Race each read against the deadline: a pending region loader keeps
        // the React stream open, so without this the awaited read would hold
        // past the deadline until the region timeout settles the stream.
        const { done, value } = await Promise.race([reader.read(), aborted]);
        if (done) {
          break;
        }
        const chunk = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
        bufferedBytes += chunk.byteLength;
        if (bufferedBytes > maxBufferedBytes) {
          throw new ShellStreamMaxBufferedBytesError(maxBufferedBytes);
        }
        chunks.push(chunk);
      }
    } catch (error) {
      await reader.cancel(error).catch(reportBestEffortStreamTeardown);
      throw error;
    } finally {
      reader.releaseLock();
    }

    const body = new Uint8Array(bufferedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  }

  private trackStream(
    stream: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    events: {
      platform: RuntimeContext["platform"] | "unknown";
      onSettle?: (summary: ShellSettleSummary) => void;
      settleRegions: () => Promise<{ settled: number; failed: number; cancelled: number }>;
      clientAborted: () => boolean;
      onDone: () => void;
    },
    regionTimeoutMs = SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS,
  ): ReadableStream<Uint8Array> {
    const reader = stream.getReader();
    let bytes = 0;
    let shellCommitted = false;
    let settled = false;
    // Bounded teardown: a region loader that ignores abort and has no
    // timeout must not hang cancel/pull/teardown forever. After the region
    // timeout budget the summary reports whatever settled so far. When the
    // region timeout is disabled, teardown still caps at the default budget
    // so client disconnect always settles.
    const settleBounded = async (): Promise<{
      settled: number;
      failed: number;
      cancelled: number;
    }> => {
      const fallback = { settled: 0, failed: 0, cancelled: 0 };
      const settlePromise = events.settleRegions().catch(() => fallback);
      const budgetMs =
        Number.isFinite(regionTimeoutMs) && regionTimeoutMs > 0
          ? Math.floor(regionTimeoutMs)
          : SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          settlePromise,
          new Promise<typeof fallback>((resolve) => {
            timer = setTimeout(() => resolve(fallback), budgetMs);
          }),
        ]);
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      }
    };
    const finish = (
      summary: {
        regionsSettled: number;
        regionsFailed: number;
        regionsCancelled: number;
        timedOut: boolean;
      },
      abortReason?: ShellSettleSummary["abortReason"],
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      events.onSettle?.({
        delivery: "stream",
        platform: events.platform,
        shellCommitted,
        regionsSettled: summary.regionsSettled,
        regionsFailed: summary.regionsFailed,
        regionsCancelled: summary.regionsCancelled,
        bytes,
        timedOut: summary.timedOut,
        clientAborted: events.clientAborted(),
        ...(abortReason ? { abortReason } : {}),
      });
      events.onDone();
    };

    return new ReadableStream<Uint8Array>(
      {
        pull: async (controller) => {
          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            return;
          }
          try {
            if (signal.aborted) {
              const clientAborted = events.clientAborted();
              const cancelPromise = reader.cancel(signal.reason).catch(() => {});
              // Abort region work first: loaders observe the linked
              // controller signal, so onDone must run before awaiting
              // settlement. A loader that ignores abort and has no timeout
              // would otherwise hang settleRegions indefinitely.
              events.onDone();
              const counts = await settleBounded().catch(() => ({
                settled: 0,
                failed: 0,
                cancelled: 0,
              }));
              await cancelPromise;
              finish(
                {
                  regionsSettled: counts.settled,
                  regionsFailed: counts.failed,
                  regionsCancelled: counts.cancelled,
                  timedOut: !clientAborted,
                },
                clientAborted ? "client-abort" : "deadline",
              );
              controller.error(toShellAbortError(signal.reason));
              return;
            }
            const { done, value } = await reader.read();
            if (done) {
              if (signal.aborted || events.clientAborted()) {
                const clientAborted = events.clientAborted();
                const cancelPromise = reader.cancel(signal.reason).catch(() => {});
                events.onDone();
                const counts = await settleBounded().catch(() => ({
                  settled: 0,
                  failed: 0,
                  cancelled: 0,
                }));
                await cancelPromise;
                finish(
                  {
                    regionsSettled: counts.settled,
                    regionsFailed: counts.failed,
                    regionsCancelled: counts.cancelled,
                    timedOut: !clientAborted,
                  },
                  clientAborted ? "client-abort" : "deadline",
                );
                controller.error(toShellAbortError(signal.reason));
                return;
              }
              const counts = await settleBounded();
              finish({
                regionsSettled: counts.settled,
                regionsFailed: counts.failed,
                regionsCancelled: counts.cancelled,
                timedOut: false,
              });
              controller.close();
              reader.releaseLock();
              return;
            }
            // Stream delivery applies pull-based backpressure (desiredSize +
            // highWaterMark: 1); no cumulative byte cap so full-size shells
            // are not cut off mid-stream.
            const chunk =
              value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
            bytes += chunk.byteLength;
            shellCommitted = true;
            controller.enqueue(chunk);
          } catch (error) {
            const cancelPromise = reader.cancel(error).catch(reportBestEffortStreamTeardown);
            // Same abort-before-settle ordering as above: reader.cancel
            // forwards into the linked controller, unblocking teardown for
            // cooperative loaders before settleRegions waits on them.
            events.onDone();
            const counts = await settleBounded().catch(() => ({
              settled: 0,
              failed: 0,
              cancelled: 0,
            }));
            finish(
              {
                regionsSettled: counts.settled,
                regionsFailed: counts.failed,
                regionsCancelled: counts.cancelled,
                timedOut: false,
              },
              "render-error",
            );
            try {
              controller.error(error);
            } finally {
              await cancelPromise;
              reader.releaseLock();
            }
          }
        },
        cancel: async (reason) => {
          // Abort render/region work first: region loaders observe the linked
          // controller signal. Start upstream cancellation independently so
          // the cancel handler never waits on a region loader that ignores
          // its abort signal.
          const cancelPromise = reader.cancel(reason).catch(reportBestEffortStreamTeardown);
          events.onDone();
          const counts = await settleBounded().catch(() => ({
            settled: 0,
            failed: 0,
            cancelled: 0,
          }));
          finish(
            {
              regionsSettled: counts.settled,
              regionsFailed: counts.failed,
              regionsCancelled: counts.cancelled,
              timedOut: false,
            },
            "client-abort",
          );
          await cancelPromise;
          reader.releaseLock();
        },
      },
      new CountQueuingStrategy({ highWaterMark: 1 }),
    );
  }

  private toAbortReason(error: unknown, clientAborted: boolean): ShellSettleSummary["abortReason"] {
    if (error instanceof ShellStreamMaxBufferedBytesError) {
      return "max-buffered-bytes";
    }
    if (clientAborted || (error instanceof Error && error.name === "AbortError")) {
      return "client-abort";
    }
    if (error instanceof ShellStreamAbortedError) {
      return "deadline";
    }
    return "render-error";
  }

  /**
   * `timedOut` answers "did the render exceed its deadline" — derive it from
   * the computed `abortReason` so render errors and byte-bound aborts are not
   * misclassified as deadline timeouts.
   */
  private timedOutFor(error: unknown, clientAborted: boolean): boolean {
    return this.toAbortReason(error, clientAborted) === "deadline";
  }

  private logAndCreateSafeErrorResponse(error: unknown, routePath: string): Response {
    const response = this.createHtmlResponse(
      "<h1>Internal Server Error</h1>",
      500,
      FALLBACK_HEAD_500,
    );
    reportShellFailure("SSR rendering failed", { route: routePath, error }, routePath);
    return response;
  }

  private async handleRsc(
    route: RenderRouteIR,
    request: Request,
    context?: RuntimeContext,
  ): Promise<Response> {
    try {
      const flightRequest = parseRscFlightRequest(request);
      assertRscClientManifestVersion(route, flightRequest, this.rscClientManifestVersion);
      assertRscServerReferenceUnsupported(route, flightRequest);

      const encoder = this.rscEncoder ?? defaultRscFlightEncoder;
      const flight = await encoder(route, request, context);

      if (flightRequest.wantsFlight) {
        return new Response(flight, {
          status: 200,
          headers: createRscFlightHeaders(this.rscClientManifestVersion),
        });
      }

      const codec = await this.loadRscSsrCodec();
      const { htmlStream } = await decodeFlightToHtmlStream(codec, flight, {
        routePath: route.path,
      });
      const headMetadata = route.head?.();

      return this.createRscHtmlStreamResponse(route, headMetadata, htmlStream);
    } catch (error) {
      return this.createRscErrorResponse(error, route.path);
    }
  }

  private findRoute(request: Request): RenderRouteIR | undefined {
    const { pathname } = new URL(request.url);
    const direct = this.routes.find((route) => route.path === pathname);

    if (direct) {
      return direct;
    }

    // Client navigation/refresh path: the same route serves both HTML and
    // Flight (`/page.rsc`), so strip the suffix before matching.
    if (pathname.endsWith(".rsc")) {
      const base = pathname.slice(0, -".rsc".length) || "/";

      return this.routes.find((route) => route.path === base);
    }

    return undefined;
  }

  private createComponentProps(
    request: Request,
    context: RuntimeContext | undefined,
    regions?: RenderRouteComponentProps["regions"],
  ): RenderRouteComponentProps {
    if (!context && !regions) {
      return { request };
    }

    return {
      request,
      ...(context ? { context } : {}),
      ...(regions ? { regions } : {}),
    };
  }

  private createHtmlResponse(body: string, status: number, headMetadata?: HeadMetadata): Response {
    const shell = this.htmlShell(headMetadata, body);

    return new Response(shell, { status, headers: HTML_HEADERS });
  }

  private createRscErrorResponse(error: unknown, routePath: string): Response {
    if (
      error instanceof RscClientManifestMismatchProblem ||
      error instanceof RscClientReferenceMissingProblem
    ) {
      return new Response(
        JSON.stringify({
          error:
            error.code === "meta-vite/rsc-client-manifest-mismatch"
              ? "RSC client manifest mismatch"
              : "RSC client reference missing",
          route: routePath,
          code: error.code,
        }),
        { status: error.status, headers: JSON_HEADERS },
      );
    }

    if (
      error instanceof RscFlightNotAcceptableProblem ||
      error instanceof RscServerReferenceNotSupportedProblem
    ) {
      return new Response(
        JSON.stringify({
          error: "RSC request not supported",
          route: routePath,
          code: error.code,
        }),
        { status: error.status, headers: JSON_HEADERS },
      );
    }

    const detail = error instanceof Error ? "An internal server error occurred" : String(error);

    return new Response(
      JSON.stringify({ error: "RSC rendering failed", route: routePath, detail }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }

  private createRscHtmlStreamResponse(
    route: RenderRouteIR,
    headMetadata: HeadMetadata | undefined,
    htmlStream: ReadableStream<Uint8Array>,
  ): Response {
    const encoder = new TextEncoder();
    const { prefix, suffix } = splitRscHtmlShell(
      createRscHtmlShell(headMetadata, "", this.rscClientManifestVersion),
    );
    void route;

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(prefix));
        const reader = htmlStream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          controller.enqueue(value);
        }
        controller.enqueue(encoder.encode(suffix));
        controller.close();
      },
    });

    return new Response(body, { status: 200, headers: HTML_HEADERS });
  }

  private htmlShell(headMetadata: HeadMetadata | undefined, bodyHtml: string): string {
    const title = this.escapeHtml(headMetadata?.title ?? "Croco App");

    let metaTags = "";
    if (headMetadata?.description) {
      metaTags += `\n    <meta name="description" content="${this.escapeHtml(headMetadata.description)}">`;
    }
    if (headMetadata?.canonical) {
      metaTags += `\n    <link rel="canonical" href="${this.escapeHtml(headMetadata.canonical)}">`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>${metaTags}
  </head>
  <body>
    <div id="root">${bodyHtml}</div>
  </body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
}

function splitRscHtmlShell(shell: string): { prefix: string; suffix: string } {
  const marker = '<div id="root"></div>';
  const index = shell.indexOf(marker);

  if (index === -1) {
    return { prefix: `${shell}\n`, suffix: "" };
  }

  const contentStart = index + '<div id="root">'.length;
  const endMarker = "</div>";
  const end = shell.indexOf(endMarker, contentStart);

  if (end === -1) {
    return { prefix: shell.slice(0, contentStart), suffix: "" };
  }

  return {
    prefix: shell.slice(0, contentStart),
    suffix: `${endMarker}${shell.slice(end + endMarker.length)}`,
  };
}

async function defaultRscFlightEncoder(
  route: RenderRouteIR,
  request: Request,
  context?: RuntimeContext,
): Promise<ReadableStream<Uint8Array>> {
  void request;
  void context;

  if (!route.componentRef) {
    throw new RscFlightNotAcceptableProblem(route.path);
  }

  return encodeRscFlightInIsolatedEncoder({ route, request, context });
}

function reportBestEffortStreamTeardown(): void {
  // Best-effort teardown runs after the settle summary is preserved above.
  // No additional logging sink exists here; the summary carries the evidence.
}

function toShellAbortError(reason: unknown): Error {
  return reason instanceof Error ? reason : new ShellStreamAbortedError(reason);
}

function reportShellFailure(message: string, detail: unknown, routePath: string): void {
  // Logging sinks can throw (or throw while inspecting detail). The fallback
  // request keeps the safe 500 contract with the pre-existing warn signature.
  try {
    console.error(message, detail);
  } catch {
    try {
      console.warn(`${message}; error logging failed`, routePath);
    } catch {
      reportBestEffortStreamTeardown();
    }
  }
}

function DeferredRegionOutlet({
  id,
  reader,
  routePath,
}: {
  id: string;
  reader: NonNullable<RenderRouteComponentProps["regions"]> | undefined;
  routePath: string;
}): ReactNode {
  if (!reader) {
    return createElement("div", { "data-region": id });
  }

  const result = readRegionSync(reader, id, routePath);
  if (result.status === "ok") {
    return createElement("div", { "data-region": id }, String(result.value ?? ""));
  }

  throw result.promise;
}

type RegionReadResult =
  | { readonly status: "ok"; readonly value: unknown }
  | { readonly status: "pending"; readonly promise: Promise<unknown> };

const regionCache = new WeakMap<object, Map<string, RegionReadResult>>();

function readRegionSync(
  reader: NonNullable<RenderRouteComponentProps["regions"]>,
  id: string,
  routePath: string,
): RegionReadResult {
  let perReader = regionCache.get(reader);
  if (!perReader) {
    perReader = new Map();
    regionCache.set(reader, perReader);
  }

  const cached = perReader.get(id);
  if (cached) {
    return cached;
  }

  const pending: RegionReadResult = {
    status: "pending",
    promise: reader.readRegion(id).then(
      (value: unknown) => {
        perReader?.set(id, { status: "ok", value });
      },
      (error: unknown) => {
        // After-flush region errors keep the Suspense fallback and are
        // observed through console.error; status and stack stay hidden.
        reportShellFailure(
          "SSR deferred region failed",
          { route: routePath, region: id, error },
          routePath,
        );
        perReader?.set(id, { status: "ok", value: "" });
      },
    ),
  };
  perReader.set(id, pending);
  return pending;
}
