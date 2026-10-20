import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BaseStorageProvider,
  InvalidKeyProblem,
  readStorageStream,
  validateSignedUrlExpiry,
} from "@croco/storage-core";
import type {
  ObjectMetadata,
  SignedUrlOptions,
  StorageBody,
  StorageOperationOptions,
  StorageStream,
} from "@croco/storage-core";
import { S3StorageProblem } from "./S3StorageProblem";
import type { S3PutOptions, S3ReadOptions, S3StorageOptions } from "./types";

const PART_BYTES = 5 * 1024 * 1024;
const MAX_PARTS = 10_000;

/** Node/Lambda S3 adapter. Sequential multipart bounds buffering and awaits cleanup. */
export class S3StorageProvider extends BaseStorageProvider {
  private readonly client: S3Client;
  private readonly options: S3StorageOptions;

  constructor(options: S3StorageOptions) {
    super();
    this.options = { ...options };
    if (!options.bucket?.trim() || !options.region?.trim()) {
      throw new S3StorageProblem("configuration");
    }
    if (
      options.cleanupTimeoutMs !== undefined &&
      (!Number.isSafeInteger(options.cleanupTimeoutMs) ||
        options.cleanupTimeoutMs < 1 ||
        options.cleanupTimeoutMs > 2_147_483_647)
    ) {
      throw new S3StorageProblem("configuration");
    }
    const prefix = options.keyPrefix ?? "";
    if (prefix) {
      if (!prefix.endsWith("/")) throw new S3StorageProblem("configuration");
      this.validateKey(prefix.slice(0, -1));
    }
    if (options.publicUrlBase) {
      const url = URL.parse(options.publicUrlBase);
      if (
        !url ||
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new S3StorageProblem("configuration");
      }
    }
    this.client = new S3Client({
      region: options.region,
      credentials: options.credentials,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  /** Dispose only after every invocation and returned stream has finished. */
  destroy(): void {
    this.client.destroy();
  }

  private objectKey(key: string): string {
    this.validateKey(key);
    const objectKey = `${this.options.keyPrefix ?? ""}${key}`;
    if (new TextEncoder().encode(objectKey).byteLength > 1024) {
      throw new InvalidKeyProblem(
        key,
        "S3 keys must be at most 1024 UTF-8 bytes including namespace",
      );
    }
    return objectKey;
  }

  async put(key: string, data: StorageBody, options?: S3PutOptions): Promise<void> {
    const Key = this.objectKey(key);
    this.assertOperationNotAborted(options, "put", key);
    // ACLs are deliberately absent: bucket ownership/block-public-access remain authoritative.
    if (options?.isPublic) throw new S3StorageProblem("public-acl-unsupported");
    const params = {
      Bucket: this.options.bucket,
      Key,
      ContentType: options?.contentType,
      CacheControl: options?.cacheControl,
      Metadata: options?.metadata,
    };
    let uploadId: string | undefined;
    try {
      if (!(data instanceof Uint8Array) && typeof data?.getReader !== "function")
        throw new S3StorageProblem("invalid-body");
      if (data instanceof Uint8Array && data.byteLength <= PART_BYTES) {
        await this.client.send(
          new PutObjectCommand({
            ...params,
            Body: data,
            IfMatch: options?.ifMatch,
            IfNoneMatch: options?.ifNoneMatch,
          }),
          { abortSignal: options?.signal },
        );
      } else {
        const stream =
          data instanceof Uint8Array
            ? new ReadableStream<Uint8Array>({
                start(c) {
                  c.enqueue(data);
                  c.close();
                },
              })
            : data;
        const parts: { ETag: string; PartNumber: number }[] = [];
        // bindOperationSignal also cancels a source stalled between network requests.
        for await (const Body of this.chunks(
          this.bindOperationSignal(stream, options, "put", key),
        )) {
          if (!uploadId) {
            const response = await this.client.send(new CreateMultipartUploadCommand(params), {
              abortSignal: options?.signal,
            });
            uploadId = response.UploadId;
            if (!uploadId) throw new S3StorageProblem("multipart-init");
          }
          if (parts.length >= MAX_PARTS) throw new S3StorageProblem("multipart-limit");
          const PartNumber = parts.length + 1;
          const response = await this.client.send(
            new UploadPartCommand({
              Bucket: params.Bucket,
              Key,
              UploadId: uploadId,
              PartNumber,
              Body,
            }),
            { abortSignal: options?.signal },
          );
          if (!response.ETag) throw new S3StorageProblem("multipart-part");
          parts.push({ ETag: response.ETag, PartNumber });
        }
        if (uploadId) {
          await this.client.send(
            new CompleteMultipartUploadCommand({
              Bucket: params.Bucket,
              Key,
              UploadId: uploadId,
              MultipartUpload: { Parts: parts },
              IfMatch: options?.ifMatch,
              IfNoneMatch: options?.ifNoneMatch,
            }),
            { abortSignal: options?.signal },
          );
          uploadId = undefined;
        } else {
          await this.client.send(
            new PutObjectCommand({
              ...params,
              Body: new Uint8Array(),
              IfMatch: options?.ifMatch,
              IfNoneMatch: options?.ifNoneMatch,
            }),
            { abortSignal: options?.signal },
          );
        }
      }
      this.assertOperationNotAborted(options, "put", key);
    } catch (error) {
      if (uploadId) {
        try {
          // Never pass the cancelled signal: cleanup must finish before the host returns.
          await this.client.send(
            new AbortMultipartUploadCommand({ Bucket: params.Bucket, Key, UploadId: uploadId }),
            { abortSignal: AbortSignal.timeout(this.options.cleanupTimeoutMs ?? 5000) },
          );
        } catch (cleanupError) {
          throw new S3StorageProblem("put", {
            cleanupFailed: true,
            cause: new AggregateError([error, cleanupError], "S3 upload and cleanup failed"),
          });
        }
      }
      this.rethrowOperationAbort(error, options, "put", key);
      throw new S3StorageProblem("put", { cause: error });
    }
  }

  private async *chunks(stream: StorageStream): AsyncGenerator<Uint8Array> {
    let part = new Uint8Array(PART_BYTES);
    let used = 0;
    for await (const chunk of stream) {
      if (!(chunk instanceof Uint8Array)) throw new S3StorageProblem("invalid-body");
      let offset = 0;
      while (offset < chunk.byteLength) {
        const count = Math.min(PART_BYTES - used, chunk.byteLength - offset);
        part.set(chunk.subarray(offset, offset + count), used);
        used += count;
        offset += count;
        if (used === PART_BYTES) {
          yield part;
          part = new Uint8Array(PART_BYTES);
          used = 0;
        }
      }
    }
    if (used) yield part.subarray(0, used);
  }

  async get(key: string, options?: S3ReadOptions): Promise<Uint8Array> {
    this.assertOperationNotAborted(options, "get", key);
    try {
      return await readStorageStream(await this.getStream(key, options));
    } catch (error) {
      this.rethrowOperationAbort(error, options, "get", key);
      throw error;
    }
  }

  async getStream(key: string, options?: S3ReadOptions): Promise<StorageStream> {
    const Key = this.objectKey(key);
    this.assertOperationNotAborted(options, "getStream", key);
    const range = options?.range;
    if (
      range &&
      (!Number.isSafeInteger(range.start) ||
        range.start < 0 ||
        (range.end !== undefined && (!Number.isSafeInteger(range.end) || range.end < range.start)))
    ) {
      throw new S3StorageProblem("invalid-range");
    }
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key,
          Range: range ? `bytes=${range.start}-${range.end ?? ""}` : undefined,
        }),
        { abortSignal: options?.signal },
      );
      if (!response.Body) throw new S3StorageProblem("empty-body");
      const source = response.Body.transformToWebStream();
      if (options?.signal?.aborted) {
        await source.cancel(options.signal.reason);
        this.assertOperationNotAborted(options, "getStream", key);
      }
      const reader = source.getReader();
      const mapped = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) {
              reader.releaseLock();
              controller.close();
            } else controller.enqueue(next.value);
          } catch (cause) {
            reader.releaseLock();
            controller.error(new S3StorageProblem("getStream", { cause }));
          }
        },
        async cancel(reason) {
          try {
            await reader.cancel(reason);
          } finally {
            reader.releaseLock();
          }
        },
      });
      return this.bindOperationSignal(mapped, options, "getStream", key);
    } catch (error) {
      this.rethrowOperationAbort(error, options, "getStream", key);
      this.readFailure(key, "getStream", error);
    }
  }

  async delete(key: string, options?: StorageOperationOptions): Promise<void> {
    const Key = this.objectKey(key);
    this.assertOperationNotAborted(options, "delete", key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key }), {
        abortSignal: options?.signal,
      });
      this.assertOperationNotAborted(options, "delete", key);
    } catch (error) {
      this.rethrowOperationAbort(error, options, "delete", key);
      throw new S3StorageProblem("delete", { cause: error });
    }
  }

  async exists(key: string, options?: StorageOperationOptions): Promise<boolean> {
    this.objectKey(key);
    this.assertOperationNotAborted(options, "exists", key);
    try {
      await this.getMetadata(key, options);
      return true;
    } catch (error) {
      this.rethrowOperationAbort(error, options, "exists", key);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "STORAGE_FILE_NOT_FOUND"
      )
        return false;
      throw error;
    }
  }

  async getMetadata(key: string, options?: StorageOperationOptions): Promise<ObjectMetadata> {
    const Key = this.objectKey(key);
    this.assertOperationNotAborted(options, "getMetadata", key);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key }),
        { abortSignal: options?.signal },
      );
      this.assertOperationNotAborted(options, "getMetadata", key);
      if (response.ContentLength === undefined || !response.LastModified)
        throw new S3StorageProblem("metadata");
      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error) {
      this.rethrowOperationAbort(error, options, "getMetadata", key);
      this.readFailure(key, "getMetadata", error);
    }
  }

  getPublicUrl(key: string): string {
    const Key = this.objectKey(key);
    if (!this.options.publicUrlBase) throw new S3StorageProblem("public-url-unconfigured");
    return `${this.options.publicUrlBase.replace(/\/+$/, "")}/${Key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const Key = this.objectKey(key);
    this.assertOperationNotAborted(options, "getSignedUrl", key);
    const expiresIn = validateSignedUrlExpiry(options.expiresIn);
    try {
      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.options.bucket, Key }),
        { expiresIn },
      );
      this.assertOperationNotAborted(options, "getSignedUrl", key);
      return url;
    } catch (error) {
      this.rethrowOperationAbort(error, options, "getSignedUrl", key);
      throw new S3StorageProblem("getSignedUrl", { cause: error });
    }
  }

  private readFailure(key: string, operation: string, error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "$metadata" in error &&
      (error.$metadata as { httpStatusCode?: number })?.httpStatusCode === 404
    )
      this.throwNotFound(key);
    throw new S3StorageProblem(operation, { cause: error });
  }
}
