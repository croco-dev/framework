import type { WarehouseReadRequest, WarehouseReader } from "@croco/warehouse-core/runtime";

async function awaitSourceOperation<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  let onAbort: (() => void) | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      onAbort = () => reject(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
      operation.then(resolve, reject);
    });
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}

export async function* cancellableSource<T>(
  source: AsyncIterable<T>,
  signal?: AbortSignal,
): AsyncIterable<T> {
  signal?.throwIfAborted();
  const iterator = source[Symbol.asyncIterator]();
  let complete = false;
  try {
    while (true) {
      const result = await awaitSourceOperation(
        Promise.resolve().then(() => {
          signal?.throwIfAborted();
          return iterator.next();
        }),
        signal,
      );
      signal?.throwIfAborted();
      if (result.done) {
        complete = true;
        return;
      }
      yield result.value;
    }
  } finally {
    if (!complete && iterator.return) {
      // Cleanup is attempted, but cancellation also interrupts a blocked return operation.
      await awaitSourceOperation(
        Promise.resolve().then(() => iterator.return?.()),
        signal,
      );
    }
  }
}

export async function* readBoundedWarehouse(
  reader: WarehouseReader,
  request: Omit<WarehouseReadRequest, "cursor">,
  limits: { readonly maxRows: number; readonly maxBytes: number; readonly maxPages: number },
  fail: (detail: string) => never,
): AsyncIterable<Readonly<Record<string, unknown>>> {
  const { signal, ...parameters } = request;
  request = { ...structuredClone(parameters), ...(signal ? { signal } : {}) };
  limits = { ...limits };
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1))
    fail("Invalid warehouse page identity or cursor");
  let cursor: string | undefined;
  let rows = 0;
  let bytes = 0;
  const cursors = new Set<string>();
  for (let pageIndex = 0; pageIndex < limits.maxPages; pageIndex++) {
    request.signal?.throwIfAborted();
    const maxRows = Math.min(request.maxRows, limits.maxRows - rows);
    const maxBytes = Math.min(request.maxBytes, limits.maxBytes - bytes);
    if (maxRows <= 0 || maxBytes <= 0) fail("Source budget exceeded");
    const page = await reader.read({
      ...request,
      maxRows,
      maxBytes,
      ...(cursor ? { cursor } : {}),
    });
    request.signal?.throwIfAborted();
    if (
      page.snapshotId !== request.snapshotId ||
      page.permissionEpoch !== request.access.permissionEpoch ||
      page.privacyEpoch !== request.access.privacyEpoch ||
      page.exactness !== "exact"
    )
      fail("Invalid warehouse page identity or cursor");
    const pageBytes = new TextEncoder().encode(JSON.stringify(page.rows)).length;
    if (page.rows.length > maxRows || pageBytes > maxBytes) fail("Source page budget exceeded");
    rows += page.rows.length;
    bytes += pageBytes;
    if (rows > limits.maxRows || bytes > limits.maxBytes) fail("Source budget exceeded");
    for (const row of page.rows) {
      request.signal?.throwIfAborted();
      yield row;
    }
    if (page.nextCursor === null) return;
    if (!page.rows.length || cursors.has(page.nextCursor))
      fail("Invalid warehouse page identity or cursor");
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  fail("Page budget exceeded");
}
