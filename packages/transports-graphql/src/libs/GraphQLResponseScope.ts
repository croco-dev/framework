import { AsyncLocalStorage } from "node:async_hooks";
import { Context } from "@croco/framework-context";

/** Keeps standalone response work in its request scope; inherited scopes retain their owner. */
export async function runWithGraphQLResponseScope(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  reportCancellationFailure: (error: unknown) => void,
): Promise<Response> {
  const active = Context.get();
  const scope = active ? undefined : Context.createRequestScope({ requestId: crypto.randomUUID() });
  // Late cancellation retains request metadata after disposal without reviving providers.
  const enter = scope
    ? scope.run(() => AsyncLocalStorage.snapshot())
    : AsyncLocalStorage.snapshot();
  const run = <T>(fn: () => T): T => (scope ? scope.run(fn) : enter(fn));
  let finished = false;
  let cancelling = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let output: ReadableStreamDefaultController<Uint8Array> | undefined;
  const finish = (failure?: { readonly error: unknown }) => {
    if (finished) return;
    finished = true;
    request.signal.removeEventListener("abort", abort);
    scope?.dispose(failure);
  };
  const cancel = (reason: unknown): Promise<void> => {
    const source = reader;
    if (!source) return Promise.resolve();
    return run(() => source.cancel(reason)).finally(() => source.releaseLock());
  };
  const abort = () => {
    const error: unknown = request.signal.reason;
    output?.error(error);
    try {
      void cancel(error).catch(reportCancellationFailure);
    } finally {
      finish({ error });
    }
  };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    request.signal.throwIfAborted();
    const response = await run(() => handler(request));
    if (finished) {
      void enter(() => response.body?.cancel(request.signal.reason))?.catch(
        reportCancellationFailure,
      );
      request.signal.throwIfAborted();
    }
    if (!response.body) {
      finish();
      return response;
    }
    const source = response.body.getReader();
    reader = source;
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          output = controller;
        },
        async pull(controller) {
          try {
            const chunk = await run(() => source.read());
            if (finished || cancelling) return;
            if (chunk.done) {
              finish();
              source.releaseLock();
              controller.close();
            } else controller.enqueue(chunk.value);
          } catch (error) {
            if (request.signal.aborted || cancelling) return;
            finish({ error });
            source.releaseLock();
            controller.error(error);
          }
        },
        async cancel(reason: unknown) {
          if (finished) return;
          cancelling = true;
          try {
            await cancel(reason);
          } catch (error) {
            finish({ error });
            throw error;
          } finally {
            finish();
          }
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body, response);
  } catch (error) {
    finish({ error });
    throw error;
  }
}
