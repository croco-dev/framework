import { DeleteFailedProblem } from "./problems/DeleteFailedProblem";
import { FileNotFoundProblem } from "./problems/FileNotFoundProblem";
import { InvalidKeyProblem } from "./problems/InvalidKeyProblem";
import { StorageOperationAbortedProblem } from "./problems/StorageOperationAbortedProblem";
import { UploadFailedProblem } from "./problems/UploadFailedProblem";
import { readStorageStream } from "./storageBody";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageStream,
  StorageOperation,
  StorageOperationOptions,
  StorageProvider,
} from "./types";

export abstract class BaseStorageProvider implements StorageProvider {
  protected validateKey(key: string): void {
    if (!key || typeof key !== "string") {
      throw new InvalidKeyProblem(key, "Key must be a non-empty string");
    }
    if (key.startsWith("/") || key.endsWith("/")) {
      throw new InvalidKeyProblem(key, "Key must not start or end with /");
    }
    if (key.includes("//")) {
      throw new InvalidKeyProblem(key, "Key must not contain //");
    }
  }

  async get(key: string, options?: StorageOperationOptions): Promise<Uint8Array> {
    this.assertOperationNotAborted(options, "get", key);
    try {
      const stream = await this.getStream(key, options);
      return await readStorageStream(this.bindOperationSignal(stream, options, "get", key));
    } catch (error) {
      this.rethrowOperationAbort(error, options, "get", key);
      throw error;
    }
  }

  async exists(key: string, options?: StorageOperationOptions): Promise<boolean> {
    this.assertOperationNotAborted(options, "exists", key);

    try {
      const stream = await this.getStream(key, options);
      await stream.cancel();
      return true;
    } catch (error) {
      if (error instanceof StorageOperationAbortedProblem) {
        throw new StorageOperationAbortedProblem("exists", key, error.cause);
      }
      if (error instanceof FileNotFoundProblem) {
        return false;
      }
      throw error;
    }
  }

  protected throwNotFound(key: string, cause?: unknown): never {
    throw new FileNotFoundProblem(key, cause instanceof Error ? cause : undefined);
  }

  protected throwUploadFailed(key: string, cause?: unknown): never {
    const reason =
      cause instanceof Error ? cause.message : typeof cause === "string" ? cause : undefined;
    throw new UploadFailedProblem(key, reason, cause instanceof Error ? cause : undefined);
  }

  protected throwDeleteFailed(key: string, cause?: unknown): never {
    throw new DeleteFailedProblem(key, cause);
  }

  protected assertOperationNotAborted(
    options: StorageOperationOptions | undefined,
    operation: StorageOperation,
    key?: string,
  ): void {
    if (options?.signal?.aborted) {
      throw this.createOperationAbortedProblem(options.signal, operation, key);
    }
  }

  protected rethrowOperationAbort(
    error: unknown,
    options: StorageOperationOptions | undefined,
    operation: StorageOperation,
    key?: string,
  ): void {
    if (error instanceof StorageOperationAbortedProblem) {
      throw new StorageOperationAbortedProblem(operation, key, error.cause);
    }

    if (options?.signal?.aborted) {
      throw this.createOperationAbortedProblem(options?.signal, operation, key, error);
    }
  }

  protected bindOperationSignal(
    stream: StorageStream,
    options: StorageOperationOptions | undefined,
    operation: StorageOperation,
    key?: string,
  ): StorageStream {
    const signal = options?.signal;
    if (signal === undefined) {
      return stream;
    }

    this.assertOperationNotAborted(options, operation, key);
    const reader = stream.getReader();
    let aborted = false;
    let removeAbortListener = () => {};

    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const onAbort = () => {
          aborted = true;
          const problem = this.createOperationAbortedProblem(signal, operation, key);
          removeAbortListener();
          void reader.cancel(problem).catch(() => {});
          controller.error(problem);
        };

        removeAbortListener = () => signal.removeEventListener("abort", onAbort);
        signal.addEventListener("abort", onAbort, { once: true });
      },
      pull: async (controller) => {
        try {
          const result = await reader.read();
          if (aborted) {
            return;
          }
          if (result.done) {
            removeAbortListener();
            controller.close();
            return;
          }
          controller.enqueue(result.value);
        } catch (error) {
          if (aborted) {
            return;
          }
          removeAbortListener();
          try {
            this.rethrowOperationAbort(error, options, operation, key);
          } catch (abortProblem) {
            controller.error(abortProblem);
            return;
          }
          controller.error(error);
        }
      },
      cancel: async (reason) => {
        removeAbortListener();
        await reader.cancel(reason);
      },
    });
  }

  private createOperationAbortedProblem(
    signal: AbortSignal | undefined,
    operation: StorageOperation,
    key: string | undefined,
    error?: unknown,
  ): StorageOperationAbortedProblem {
    const cause = this.resolveAbortCause(signal, error);
    return new StorageOperationAbortedProblem(operation, key, cause);
  }

  private resolveAbortCause(signal: AbortSignal | undefined, error: unknown): Error | undefined {
    if (signal?.aborted) {
      if (signal.reason instanceof Error) {
        return signal.reason;
      }

      const cause = new Error("Storage operation aborted with a non-Error reason");
      Object.defineProperty(cause, "cause", {
        configurable: true,
        value: signal.reason,
      });
      return cause;
    }

    return error instanceof Error ? error : undefined;
  }

  abstract put(key: string, data: StorageBody, options?: PutOptions): Promise<void>;
  abstract getStream(key: string, options?: StorageOperationOptions): Promise<StorageStream>;
  abstract delete(key: string, options?: StorageOperationOptions): Promise<void>;
  abstract getPublicUrl(key: string): string;
  abstract getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  abstract getMetadata(key: string, options?: StorageOperationOptions): Promise<ObjectMetadata>;
}
