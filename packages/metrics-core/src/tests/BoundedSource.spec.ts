import { describe, expect, it, vi } from "vitest";
import { Problem } from "@croco/problems-core";
import { cancellableSource } from "../libs/read/BoundedSource";

function source(
  next: () => Promise<IteratorResult<number>>,
  close: () => Promise<IteratorResult<number>>,
) {
  const iterator = { next: vi.fn(next), return: vi.fn(close) };
  return { iterator, iterable: { [Symbol.asyncIterator]: () => iterator } };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function collect(iterable: AsyncIterable<number>) {
  const values: number[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("cancellableSource", () => {
  it.each([new Error("read-failed"), Object.freeze(new Error("frozen-read")), undefined])(
    "retains both read and cleanup failures without mutating the primary failure: %s",
    async (readFailure) => {
      const cleanupFailure = new Error("close-failed");
      const fixture = source(
        () => Promise.reject(readFailure),
        () => Promise.reject(cleanupFailure),
      );
      const error = await collect(cancellableSource(fixture.iterable)).catch(
        (failure: unknown) => failure,
      );
      expect(error).toBeInstanceOf(Problem);
      expect(error).toMatchObject({ code: "metrics-core/source-cleanup-failed" });
      const aggregate = (error as Problem).cause as AggregateError;
      expect(aggregate).toBeInstanceOf(AggregateError);
      expect(aggregate.cause).toBe(readFailure);
      expect(aggregate.errors).toEqual([readFailure, cleanupFailure]);
      expect(fixture.iterator.return).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves an independent read failure when cleanup succeeds", async () => {
    const failure = new Error("read-failed");
    const fixture = source(
      () => Promise.reject(failure),
      async () => ({ done: true, value: undefined }),
    );
    await expect(collect(cancellableSource(fixture.iterable))).rejects.toBe(failure);
    expect(fixture.iterator.return).toHaveBeenCalledTimes(1);
  });

  it("exposes cleanup-only failure after a consumer break", async () => {
    const failure = new Error("close-failed");
    const fixture = source(
      async () => ({ done: false, value: 37 }),
      () => Promise.reject(failure),
    );
    const consume = async () => {
      for await (const value of cancellableSource(fixture.iterable)) {
        expect(value).toBe(37);
        break;
      }
    };
    await expect(consume()).rejects.toBe(failure);
    expect(fixture.iterator.return).toHaveBeenCalledTimes(1);
  });

  it("closes once on a successful break and does not close again after EOF", async () => {
    const fixture = source(
      async () => ({ done: false, value: 41 }),
      async () => ({ done: true, value: undefined }),
    );
    for await (const value of cancellableSource(fixture.iterable)) {
      expect(value).toBe(41);
      break;
    }
    expect(fixture.iterator.return).toHaveBeenCalledTimes(1);
    const eof = source(
      async () => ({ done: true, value: undefined }),
      async () => ({ done: true, value: undefined }),
    );
    await expect(collect(cancellableSource(eof.iterable))).resolves.toEqual([]);
    expect(eof.iterator.return).not.toHaveBeenCalled();
  });

  it.each([Object.freeze(new Error("request-aborted")), Number.NaN])(
    "preserves abort identity without waiting for blocked operations and observes late rejections: %s",
    async (reason) => {
      const read = deferred<IteratorResult<number>>();
      const close = deferred<IteratorResult<number>>();
      const started = deferred<void>();
      const fixture = source(
        () => {
          started.resolve();
          return read.promise;
        },
        () => close.promise,
      );
      const controller = new AbortController();
      const result = collect(cancellableSource(fixture.iterable, controller.signal));
      const assertion = expect(result).rejects.toBe(reason);
      await started.promise;
      controller.abort(reason);
      await assertion;
      expect(fixture.iterator.return).toHaveBeenCalledTimes(1);
      read.reject(new Error("late-read-failed"));
      close.reject(new Error("late-close-failed"));
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
  );

  it("preserves cancellation priority when it interrupts cleanup after a read failure", async () => {
    const failure = new Error("read-before-abort");
    const close = deferred<IteratorResult<number>>();
    const started = deferred<void>();
    const fixture = source(
      () => Promise.reject(failure),
      () => {
        started.resolve();
        return close.promise;
      },
    );
    const controller = new AbortController();
    const result = collect(cancellableSource(fixture.iterable, controller.signal));
    const reason = new Error("abort-during-close");
    const assertion = expect(result).rejects.toBe(reason);
    await started.promise;
    controller.abort(reason);
    await assertion;
    expect(fixture.iterator.return).toHaveBeenCalledTimes(1);
    close.reject(new Error("late-close-failed"));
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it("does not acquire an iterator for an already aborted request", async () => {
    const fixture = source(
      async () => ({ done: false, value: 1 }),
      async () => ({ done: true, value: undefined }),
    );
    const controller = new AbortController();
    const reason = new Error("already-aborted");
    controller.abort(reason);
    await expect(collect(cancellableSource(fixture.iterable, controller.signal))).rejects.toBe(
      reason,
    );
    expect(fixture.iterator.next).not.toHaveBeenCalled();
    expect(fixture.iterator.return).not.toHaveBeenCalled();
  });
});
