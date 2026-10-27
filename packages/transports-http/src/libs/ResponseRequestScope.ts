import { Context } from "@croco/framework-context";
import type { RequestContext } from "@croco/framework-context";

/** Owns the request scope until the host consumes or abandons the response body. */
export async function runWithResponseRequestScope(
  context: RequestContext,
  request: Request,
  handler: (releaseAfterFailure: (error: unknown) => void) => Promise<Response>,
  reportCancellationFailure: (error: unknown) => void,
): Promise<Response> {
  const scope = Context.createRequestScope(context);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let output: ReadableStreamDefaultController<Uint8Array> | undefined;
  let finished = false;
  let cancelling = false;
  const finish = (failure?: { readonly error: unknown }): void => {
    if (finished) return;
    finished = true;
    request.signal.removeEventListener("abort", abort);
    scope.dispose(failure);
  };
  const abort = (): void => {
    const error: unknown = request.signal.reason;
    output?.error(error);
    try {
      const cancellation = reader ? scope.run(() => reader?.cancel(error)) : undefined;
      void cancellation?.catch(reportCancellationFailure);
    } finally {
      finish({ error });
    }
  };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    if (request.signal.aborted) {
      abort();
      request.signal.throwIfAborted();
    }
    const response = await scope.run(() => handler((error) => finish({ error })));
    if (finished) {
      if (request.signal.aborted) {
        await response.body?.cancel(request.signal.reason);
        request.signal.throwIfAborted();
      }
      return response;
    }
    if (!response.body || request.method.toUpperCase() === "HEAD") {
      try {
        await scope.run(() => response.body?.cancel());
      } finally {
        finish();
      }
      return new Response(null, response);
    }
    const responseReader = response.body.getReader();
    reader = responseReader;
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          output = controller;
        },
        async pull(controller) {
          try {
            const chunk = await scope.run(() => responseReader.read());
            if (finished || cancelling) return;
            if (chunk.done) {
              finish();
              controller.close();
              responseReader.releaseLock();
            } else {
              controller.enqueue(chunk.value);
            }
          } catch (error) {
            if (finished || cancelling) return;
            finish({ error });
            controller.error(error);
            responseReader.releaseLock();
          }
        },
        async cancel(reason: unknown) {
          if (finished) return;
          cancelling = true;
          try {
            await scope.run(() => responseReader.cancel(reason));
          } catch (error) {
            finish({ error });
            throw error;
          } finally {
            finish();
            responseReader.releaseLock();
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
