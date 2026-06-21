import type { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ConfigService } from "@croco/framework-config";
import { Component } from "@croco/framework-context";
import type { Logger } from "@croco/framework-logger";
import type { RetryPolicy } from "@croco/retry-core";
import { RetryTemplate } from "@croco/retry-core";
import type { ObjectMetadata, PutOptions, SignedUrlOptions } from "@croco/storage-core";
import { BaseStorageProvider } from "@croco/storage-core";
import { EmptyR2BodyProblem } from "./problems/EmptyR2BodyProblem";
import { R2ObjectTooLargeProblem } from "./problems/R2ObjectTooLargeProblem";
import { validateR2Options } from "./R2Config";
import type { R2Options } from "./types";

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNRESET",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "RequestTimeout",
  "RequestTimeoutException",
  "SlowDown",
  "Throttling",
  "ThrottlingException",
  "TimeoutError",
  "TooManyRequestsException",
]);

type R2Error = Error & {
  code?: string;
  name?: string;
  status?: number;
  statusCode?: number;
  $metadata?: {
    httpStatusCode?: number;
  };
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  if ("$metadata" in error) {
    const metadata = error.$metadata as { httpStatusCode?: number };
    if (typeof metadata.httpStatusCode === "number") {
      return metadata.httpStatusCode;
    }
  }

  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
};

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("name" in error && typeof error.name === "string") {
    return error.name;
  }

  return undefined;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
};

const normalizeR2Error = (error: unknown, fallback: string): R2Error => {
  if (error instanceof Error) {
    return error as R2Error;
  }

  const normalizedError = new Error(getErrorMessage(error, fallback)) as R2Error;

  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") {
      normalizedError.code = error.code;
    }

    if ("name" in error && typeof error.name === "string") {
      normalizedError.name = error.name;
    }

    if ("status" in error && typeof error.status === "number") {
      normalizedError.status = error.status;
    }

    if ("statusCode" in error && typeof error.statusCode === "number") {
      normalizedError.statusCode = error.statusCode;
    }

    if ("$metadata" in error && error.$metadata && typeof error.$metadata === "object") {
      normalizedError.$metadata = error.$metadata as { httpStatusCode?: number };
    }
  }

  return normalizedError;
};

const isRetryableR2Error = (error: unknown): boolean => {
  const status = getErrorStatus(error);

  if (typeof status === "number" && TRANSIENT_HTTP_STATUSES.has(status)) {
    return true;
  }

  const code = getErrorCode(error);
  return typeof code === "string" && TRANSIENT_ERROR_CODES.has(code);
};

const R2_RETRY_POLICY: RetryPolicy = {
  shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    return attempt < maxAttempts && isRetryableR2Error(error);
  },
};

/**
 * Cloudflare R2 스토리지 제공자
 *
 * AWS S3 SDK를 사용하여 R2와 통신합니다.
 */
@Component()
export class R2StorageProvider extends BaseStorageProvider {
  private static readonly MAX_BUFFERED_GET_BYTES = 10 * 1024 * 1024;
  private readonly client: S3Client;
  private readonly options: R2Options;
  private readonly retryTemplate = new RetryTemplate({
    maxAttempts: 3,
    backoff: {
      delay: 10,
      multiplier: 2,
      maxDelay: 50,
      jitter: false,
    },
    retryPolicy: R2_RETRY_POLICY,
  });

  constructor(
    private readonly config: ConfigService,
    readonly _logger: Logger,
  ) {
    super();
    this.options = validateR2Options({
      accountId: this.config.get("R2_ACCOUNT_ID"),
      accessKeyId: this.config.get("R2_ACCESS_KEY_ID"),
      secretAccessKey: this.config.get("R2_SECRET_ACCESS_KEY"),
      bucket: this.config.get("R2_BUCKET"),
      publicUrlBase: this.config.get("R2_PUBLIC_URL_BASE"),
    });

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${this.options.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);

    try {
      const upload = async (shouldRetry: boolean) => {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");

        const command = new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
          Body: data,
          ContentType: options?.contentType,
          CacheControl: options?.cacheControl,
          Metadata: options?.metadata,
        });

        const send = async () =>
          await this.executeR2Operation(() => this.client.send(command), "Unknown upload error");

        if (shouldRetry) {
          await this.executeWithRetry(send);
          return;
        }

        await send();
      };

      await upload(Buffer.isBuffer(data));
    } catch (error) {
      this.throwUploadFailed(key, error);
    }
  }

  async getStream(key: string): Promise<Readable> {
    this.validateKey(key);

    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    try {
      const response = await this.executeWithRetry(
        async () =>
          await this.executeR2Operation(() => this.client.send(command), "Unknown download error"),
      );

      if (!response.Body) {
        throw new EmptyR2BodyProblem(key);
      }

      return response.Body as Readable;
    } catch (error) {
      return this.handleNotFoundError(key, error);
    }
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");

      const command = new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
      });

      const response = await this.executeWithRetry(
        async () =>
          await this.executeR2Operation(() => this.client.send(command), "Unknown download error"),
      );

      if (!response.Body) {
        throw new EmptyR2BodyProblem(key);
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as Readable;
      let totalBytes = 0;

      for await (const chunk of stream) {
        totalBytes += chunk.byteLength;

        if (totalBytes > R2StorageProvider.MAX_BUFFERED_GET_BYTES) {
          throw new R2ObjectTooLargeProblem(key, R2StorageProvider.MAX_BUFFERED_GET_BYTES);
        }

        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      return this.handleNotFoundError(key, error);
    }
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    try {
      await this.executeWithRetry(async () => {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");

        const command = new DeleteObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
        });

        await this.executeR2Operation(() => this.client.send(command), "Unknown delete error");
      });
    } catch (error) {
      this.throwDeleteFailed(key, error);
    }
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    if (this.options.publicUrlBase) {
      const normalizedBase = this.options.publicUrlBase.replace(/\/+$/, "");
      return `${normalizedBase}/${key}`;
    }

    return `https://${this.options.bucket}.${this.options.accountId}.r2.dev/${key}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);

    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn,
    });
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    this.validateKey(key);

    try {
      const response = await this.executeWithRetry(async () => {
        const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

        const command = new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
        });

        return await this.executeR2Operation(
          () => this.client.send(command),
          "Unknown metadata error",
        );
      });

      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType,
        lastModified: response.LastModified ?? new Date(),
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error) {
      return this.handleNotFoundError(key, error);
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === "object" && "$metadata" in error) {
      const metadata = error.$metadata as { httpStatusCode?: number };
      return metadata.httpStatusCode === 404;
    }
    if (error instanceof Error && "name" in error) {
      return error.name === "NotFound";
    }
    return false;
  }

  private handleNotFoundError(key: string, error: unknown): never {
    if (this.isNotFoundError(error)) {
      this.throwNotFound(key, error);
    }
    throw error;
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return await this.retryTemplate.execute(async () => await operation());
  }

  private async executeR2Operation<T>(
    operation: () => Promise<T>,
    fallbackMessage: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw normalizeR2Error(error, fallbackMessage);
    }
  }
}
