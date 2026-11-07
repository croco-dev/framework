import { describe, expect, it, vi } from "vitest";
import { BaseStorageProvider } from "../libs/BaseStorageProvider";
import { DeleteFailedProblem } from "../libs/problems/DeleteFailedProblem";
import { FileNotFoundProblem } from "../libs/problems/FileNotFoundProblem";
import { UploadFailedProblem } from "../libs/problems/UploadFailedProblem";
import { storageStreamFromBytes } from "../libs/storageBody";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageStream,
  StorageOperationOptions,
} from "../libs/types";

function createDeferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class TestStorageProvider extends BaseStorageProvider {
  probeMode = false;
  streamCancelled = false;

  async put(_key: string, _data: StorageBody, _options?: PutOptions): Promise<void> {}

  async getStream(_key: string): Promise<StorageStream> {
    if (this.probeMode) {
      return new ReadableStream({
        cancel: () => {
          this.streamCancelled = true;
        },
      });
    }

    return storageStreamFromBytes(new Uint8Array([1, 2, 3]));
  }

  async delete(_key: string): Promise<void> {}

  getPublicUrl(key: string): string {
    return key;
  }

  async getSignedUrl(key: string, _options: SignedUrlOptions): Promise<string> {
    return key;
  }

  async getMetadata(_key: string): Promise<ObjectMetadata> {
    return {
      size: 0,
      lastModified: new Date(),
    };
  }

  bindStream(stream: StorageStream, options: StorageOperationOptions): StorageStream {
    return this.bindOperationSignal(stream, options, "put", "test/file.bin");
  }

  callThrowNotFound(key: string, cause?: unknown): never {
    return this.throwNotFound(key, cause);
  }

  callThrowUploadFailed(key: string, cause?: unknown): never {
    return this.throwUploadFailed(key, cause);
  }

  callThrowDeleteFailed(key: string, cause?: unknown): never {
    return this.throwDeleteFailed(key, cause);
  }
}

describe("BaseStorageProvider", () => {
  const provider = new TestStorageProvider();

  it("buffers the portable stream only for the explicit buffered get operation", async () => {
    await expect(provider.get("test/file.bin")).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it("checks existence without buffering the object body", async () => {
    provider.probeMode = true;
    provider.streamCancelled = false;

    try {
      await expect(provider.exists("test/file.bin")).resolves.toBe(true);
      expect(provider.streamCancelled).toBe(true);
    } finally {
      provider.probeMode = false;
    }
  });

  it("throwNotFound가 cause를 FileNotFoundProblem에 전달함", () => {
    const cause = new Error("missing");

    try {
      provider.callThrowNotFound("missing/file.txt", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(FileNotFoundProblem);
      expect((error as FileNotFoundProblem).cause).toBe(cause);
    }
  });

  it("throwUploadFailed가 cause를 UploadFailedProblem에 전달함", () => {
    const cause = new Error("upload failed");

    try {
      provider.callThrowUploadFailed("upload/file.txt", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(UploadFailedProblem);
      expect((error as UploadFailedProblem).cause).toBe(cause);
    }
  });

  it("throwDeleteFailed가 cause를 DeleteFailedProblem에 전달함", () => {
    const cause = new Error("delete failed");

    try {
      provider.callThrowDeleteFailed("delete/file.txt", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(DeleteFailedProblem);
      expect((error as DeleteFailedProblem).cause).toBe(cause);
    }
  });
});

describe("BaseStorageProvider signal stream ownership", () => {
  const provider = new TestStorageProvider();

  it.each(["complete", "error"])(
    "releases the reader and listener on source %s",
    async (outcome) => {
      const abort = new AbortController();
      const removeListener = vi.spyOn(abort.signal, "removeEventListener");
      const failure = new Error("source failed");
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          if (outcome === "error") controller.error(failure);
          else controller.close();
        },
      });
      const reader = provider.bindStream(source, { signal: abort.signal }).getReader();
      if (outcome === "error") await expect(reader.read()).rejects.toBe(failure);
      else await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
      expect(source.locked).toBe(false);
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      abort.abort();
      reader.releaseLock();
    },
  );

  it.each(["complete", "error"])(
    "preserves abort when source %s races a pending read",
    async (outcome) => {
      const abort = new AbortController();
      const reason = new Error("request aborted");
      let sourceController!: ReadableStreamDefaultController<Uint8Array>;
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          sourceController = controller;
        },
      });
      const reader = provider.bindStream(source, { signal: abort.signal }).getReader();
      const result = expect(reader.read()).rejects.toMatchObject({
        code: "STORAGE_OPERATION_ABORTED",
        cause: reason,
      });
      if (outcome === "complete") sourceController.close();
      else sourceController.error(new Error("source failed"));
      abort.abort(reason);
      await result;
      await vi.waitFor(() => expect(source.locked).toBe(false));
      reader.releaseLock();
    },
  );

  it.each([false, true])(
    "releases after consumer cancellation settles (reject=%s)",
    async (reject) => {
      const abort = new AbortController();
      const removeListener = vi.spyOn(abort.signal, "removeEventListener");
      const cleanup = createDeferred();
      const failure = new Error("cancel failed");
      const cancel = vi.fn(() => cleanup.promise);
      const source = new ReadableStream<Uint8Array>({ cancel });
      const reader = provider.bindStream(source, { signal: abort.signal }).getReader();
      const pendingRead = reader.read();
      const cancelled = reader.cancel("consumer finished");
      const result = reject
        ? expect(cancelled).rejects.toBe(failure)
        : expect(cancelled).resolves.toBeUndefined();
      expect(source.locked).toBe(true);
      abort.abort(new Error("late abort"));
      if (reject) cleanup.reject(failure);
      else cleanup.resolve();
      await result;
      await expect(pendingRead).resolves.toEqual({ done: true, value: undefined });
      expect(source.locked).toBe(false);
      expect(cancel).toHaveBeenCalledExactlyOnceWith("consumer finished");
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      reader.releaseLock();
    },
  );

  it.each([false, true])(
    "preserves immediate abort while cleanup is pending (reject=%s)",
    async (reject) => {
      const abort = new AbortController();
      const removeListener = vi.spyOn(abort.signal, "removeEventListener");
      const cleanup = createDeferred();
      const started = createDeferred();
      const reason = new Error("request aborted");
      const cancel = vi.fn(() => cleanup.promise);
      const source = new ReadableStream<Uint8Array>({
        pull() {
          started.resolve();
        },
        cancel,
      });
      const reader = provider.bindStream(source, { signal: abort.signal }).getReader();
      const pendingRead = reader.read();
      const result = expect(pendingRead).rejects.toMatchObject({
        code: "STORAGE_OPERATION_ABORTED",
        cause: reason,
      });
      await started.promise;
      abort.abort(reason);
      await result;
      expect(source.locked).toBe(true);
      expect(cancel).toHaveBeenCalledOnce();
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      if (reject) cleanup.reject(new Error("late cancellation failure"));
      else cleanup.resolve();
      await vi.waitFor(() => expect(source.locked).toBe(false));
      await expect(reader.read()).rejects.toMatchObject({
        code: "STORAGE_OPERATION_ABORTED",
        cause: reason,
      });
      reader.releaseLock();
    },
  );
});
