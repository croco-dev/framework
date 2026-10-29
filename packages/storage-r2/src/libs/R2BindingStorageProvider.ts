import type { R2Bucket } from "@cloudflare/workers-types/experimental";
import {
  BaseStorageProvider,
  FileNotFoundProblem,
  InvalidKeyProblem,
  validateSignedUrlExpiry,
} from "@croco/storage-core";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageOperation,
  StorageOperationOptions,
  StorageStream,
} from "@croco/storage-core";
import { R2BindingProblem } from "./problems/R2BindingProblem";
import { R2BindingUnsupportedProblem } from "./problems/R2BindingUnsupportedProblem";
import { readBufferedR2Stream } from "./readBufferedR2Stream";

/** Structural subset accepted directly from a Worker R2Bucket binding. */
export type R2BindingObject = {
  readonly size: number;
  readonly uploaded: Date;
  readonly httpEtag: string;
  readonly httpMetadata?: { readonly contentType?: string; readonly cacheControl?: string };
  readonly customMetadata?: Record<string, string>;
};
export type R2BindingObjectBody = R2BindingObject & {
  // Workers and lib.dom use different BYOB reader declarations. Require only the native
  // default-reader operations used here, so an actual R2Bucket needs no consumer cast.
  readonly body: {
    cancel(reason?: unknown): Promise<void>;
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(reason?: unknown): Promise<void>;
      releaseLock(): void;
    };
  };
};
export type R2BindingRange =
  | { offset: number; length?: number }
  | { length: number; offset?: number }
  | { suffix: number };
export type R2BindingReadOptions = StorageOperationOptions & { readonly range?: R2BindingRange };
export type R2BucketBinding = {
  get(key: string, options?: { range?: R2BindingRange }): Promise<R2BindingObjectBody | null>;
  head(key: string): Promise<R2BindingObject | null>;
  put(
    key: string,
    value: Parameters<R2Bucket["put"]>[1],
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
};
export type R2BindingStorageOptions = {
  /** Explicit public bucket/custom-domain base. It does not grant access or create a public bucket. */
  readonly publicUrlBase?: string;
};

/** Uses the native binding without S3 credentials, automatic retries or cross-request mutable state. */
export class R2BindingStorageProvider extends BaseStorageProvider {
  private readonly publicUrlBase?: string;

  constructor(
    private readonly bucket: R2BucketBinding,
    options: R2BindingStorageOptions = {},
  ) {
    super();
    if (options.publicUrlBase !== undefined) {
      let url: URL;
      try {
        url = new URL(options.publicUrlBase);
      } catch {
        throw new InvalidKeyProblem("publicUrlBase", "Expected an absolute HTTP(S) base");
      }
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new InvalidKeyProblem(
          "publicUrlBase",
          "Expected an HTTP(S) base without credentials, query or fragment",
        );
      }
      this.publicUrlBase = url.href.replace(/\/+$/, "");
    }
  }

  async put(key: string, data: StorageBody, options?: PutOptions): Promise<void> {
    this.validateKey(key);
    this.assertOperationNotAborted(options, "put", key);
    if (options?.isPublic !== undefined) throw new R2BindingUnsupportedProblem("object-acl");
    // Workers and lib.dom declare streams differently; the native stream is unchanged.
    // Wrapping it would lose the known length required by R2 uploads.
    await this.execute(
      () =>
        this.bucket.put(key, data as Parameters<R2Bucket["put"]>[1], {
          httpMetadata: { contentType: options?.contentType, cacheControl: options?.cacheControl },
          customMetadata: options?.metadata,
        }),
      options,
      "put",
      key,
    );
  }

  async get(key: string, options?: R2BindingReadOptions): Promise<Uint8Array> {
    this.validateKey(key);
    this.assertOperationNotAborted(options, "get", key);
    const stream = await this.read(key, options, "get");
    const bytes = await readBufferedR2Stream(key, stream);
    this.assertOperationNotAborted(options, "get", key);
    return bytes;
  }

  async getStream(key: string, options?: R2BindingReadOptions): Promise<StorageStream> {
    this.validateKey(key);
    this.assertOperationNotAborted(options, "getStream", key);
    return this.read(key, options, "getStream");
  }

  async delete(key: string, options?: StorageOperationOptions): Promise<void> {
    this.validateKey(key);
    await this.execute(() => this.bucket.delete(key), options, "delete", key);
  }

  async exists(key: string, options?: StorageOperationOptions): Promise<boolean> {
    this.validateKey(key);
    return (await this.execute(() => this.bucket.head(key), options, "exists", key)) !== null;
  }

  async getMetadata(key: string, options?: StorageOperationOptions): Promise<ObjectMetadata> {
    this.validateKey(key);
    const object = await this.execute(() => this.bucket.head(key), options, "getMetadata", key);
    if (object === null) throw new FileNotFoundProblem(key);
    return {
      size: object.size,
      lastModified: new Date(object.uploaded),
      etag: object.httpEtag,
      contentType: object.httpMetadata?.contentType,
      metadata: object.customMetadata ? { ...object.customMetadata } : undefined,
    };
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);
    if (!this.publicUrlBase) throw new R2BindingUnsupportedProblem("public-url");
    // Backslashes and controls are normalized by URL parsers and cannot identify the same object.
    if (
      [...key].some(
        (character) =>
          character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      throw new InvalidKeyProblem(key, "Not representable in a public URL");
    return `${this.publicUrlBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);
    this.assertOperationNotAborted(options, "getSignedUrl", key);
    validateSignedUrlExpiry(options.expiresIn);
    throw new R2BindingUnsupportedProblem("signed-url");
  }

  private async read(
    key: string,
    options: R2BindingReadOptions | undefined,
    operation: "get" | "getStream",
  ): Promise<StorageStream> {
    if (options?.range) {
      const range = options.range;
      const entries = Object.entries(range);
      if (
        entries.length === 0 ||
        entries.some(
          ([name, value]) =>
            !["offset", "length", "suffix"].includes(name) ||
            !Number.isSafeInteger(value) ||
            value < (name === "offset" ? 0 : 1),
        ) ||
        ("suffix" in range && entries.length !== 1)
      ) {
        throw new InvalidKeyProblem(key, "Invalid R2 byte range");
      }
    }
    const object = await this.execute(
      () => this.bucket.get(key, { range: options?.range }),
      options,
      operation,
      key,
      (late) => late?.body.cancel(),
    );
    if (object === null) throw new FileNotFoundProblem(key);
    try {
      this.assertOperationNotAborted(options, operation, key);
      const reader = object.body.getReader();
      let finished = false;
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const result = await reader.read();
            if (finished) return;
            if (result.done) {
              finished = true;
              reader.releaseLock();
              controller.close();
            } else if (result.value !== undefined) controller.enqueue(result.value);
          } catch (error) {
            if (finished) return;
            finished = true;
            reader.releaseLock();
            controller.error(new R2BindingProblem(operation, error));
          }
        },
        async cancel(reason) {
          if (finished) return;
          finished = true;
          try {
            await reader.cancel(reason);
          } finally {
            reader.releaseLock();
          }
        },
      });
      return this.bindOperationSignal(stream, options, operation, key);
    } catch (error) {
      await object.body.cancel(error).catch(() => {});
      throw error;
    }
  }

  private async execute<T>(
    run: () => Promise<T>,
    options: StorageOperationOptions | undefined,
    operation: StorageOperation,
    key: string,
    disposeLate?: (value: T) => Promise<unknown> | undefined,
  ): Promise<T> {
    this.assertOperationNotAborted(options, operation, key);
    const signal = options?.signal;
    let onAbort: (() => void) | undefined;
    let aborted = false;
    try {
      const pending = run();
      if (!signal) return await pending;
      return await new Promise<T>((resolve, reject) => {
        onAbort = () => {
          aborted = true;
          try {
            this.assertOperationNotAborted(options, operation, key);
          } catch (error) {
            reject(error);
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
        pending.then((value) => {
          if (aborted) {
            Promise.resolve()
              .then(() => disposeLate?.(value))
              .catch(() => {});
          } else resolve(value);
        }, reject);
      });
    } catch (error) {
      this.rethrowOperationAbort(error, options, operation, key);
      throw new R2BindingProblem(operation, error);
    } finally {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    }
  }
}
