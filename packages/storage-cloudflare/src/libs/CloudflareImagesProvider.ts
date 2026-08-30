import { Component } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import type { BackoffOptions, BackoffPolicy, RetryPolicy } from "@croco/retry-core";
import { ExponentialBackoff, RetryTemplate } from "@croco/retry-core";
import type {
  ImageProvider,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageStream,
  StorageOperation,
  StorageOperationOptions,
  TransformOptions,
  UploadIntent,
  UploadIntentOptions,
} from "@croco/storage-core";
import { BaseStorageProvider, validateSignedUrlExpiry } from "@croco/storage-core";
import {
  CloudflareImagesRetryableUpstreamProblem,
  CloudflareImagesValidationProblem,
  createCloudflareImagesResponseProblem,
  normalizeCloudflareImagesError,
} from "./CloudflareImagesDiagnosticsProvider";
import type {
  CloudflareImageDetails,
  CloudflareImagesOptions,
  CloudflareTransformOptions,
} from "./types";

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_CLOUDFLARE_IMAGE_ID_CODE_POINTS = 1024;
const MIN_DIRECT_UPLOAD_TTL_SECONDS = 2 * 60;
const MAX_DIRECT_UPLOAD_TTL_SECONDS = 6 * 60 * 60;
const DIRECT_UPLOAD_EXPIRY_MARGIN_SECONDS = 5;
const MAX_DIRECT_UPLOAD_METADATA_BYTES = 1024;
const UUID_IMAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOUDFLARE_UPLOAD_ORIGIN = "https://upload.imagedelivery.net";
const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

type RetryDelayState = {
  delayMs?: number;
};

type CloudflareImagesRuntimeResponse<TResult extends object = Record<string, unknown>> = {
  readonly errors: string[];
  readonly result?: TResult | null;
  readonly success: boolean;
};

class RetryAfterBackoff implements BackoffPolicy {
  readonly supportsAbortSignal = true;

  private readonly baseBackoff: ExponentialBackoff;
  private readonly delays = new Map<number, number>();

  constructor(
    options: BackoffOptions | undefined,
    private readonly retryDelay: RetryDelayState,
  ) {
    this.baseBackoff = new ExponentialBackoff(options);
  }

  getDelay(attempt: number): number {
    const delay = Math.max(this.baseBackoff.getDelay(attempt), this.retryDelay.delayMs ?? 0);
    this.retryDelay.delayMs = undefined;
    this.delays.set(attempt, delay);
    return delay;
  }

  async wait(attempt: number, signal?: AbortSignal): Promise<void> {
    await waitForRetryDelay(this.delays.get(attempt) ?? this.getDelay(attempt), signal);
  }

  reset(): void {
    this.baseBackoff.reset();
    this.delays.clear();
    this.retryDelay.delayMs = undefined;
  }
}

function createCloudflareImagesRetryPolicy(
  maxDelayMs: number,
  retryDelay: RetryDelayState,
): RetryPolicy {
  return {
    shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
      retryDelay.delayMs = undefined;
      if (attempt >= maxAttempts || !(error instanceof CloudflareImagesRetryableUpstreamProblem)) {
        return false;
      }

      const retryAfterMs = readRetryAfterMilliseconds(error);
      if (retryAfterMs !== undefined) {
        if (retryAfterMs > maxDelayMs) {
          return false;
        }
        retryDelay.delayMs = retryAfterMs;
      }
      return true;
    },
  };
}

function readRetryAfterMilliseconds(
  problem: CloudflareImagesRetryableUpstreamProblem,
): number | undefined {
  const retryAfter = problem.extensions?.retryAfter;
  return typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter >= 0
    ? retryAfter * 1000
    : undefined;
}

function retryAfterExtension(response: Response): { readonly retryAfter?: number } {
  const value = response.headers.get("retry-after");
  const seconds = value === null ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? { retryAfter: seconds } : {};
}

async function waitForRetryDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return;
  }
  if (signal?.aborted) {
    throw signal.reason;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
    }
  });
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function startDownloadStream(stream: StorageStream, key: string): Promise<StorageStream> {
  const reader = stream.getReader();
  let firstResult: ReadableStreamReadResult<Uint8Array>;

  try {
    firstResult = await reader.read();
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch (cancellationError: unknown) {
      // Preserve the body read failure when best-effort cleanup also fails.
      void cancellationError;
    }
    try {
      reader.releaseLock();
    } catch (releaseError: unknown) {
      // Preserve the body read failure when releasing the discarded reader fails.
      void releaseError;
    }
    throw normalizeCloudflareImagesError(error, { key, operation: "get" });
  }

  let nextResult: ReadableStreamReadResult<Uint8Array> | undefined = firstResult;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = nextResult ?? (await reader.read());
        nextResult = undefined;
        if (result.done) {
          controller.close();
          return;
        }

        controller.enqueue(result.value);
      } catch (error) {
        controller.error(normalizeCloudflareImagesError(error, { key, operation: "get" }));
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/**
 * Cloudflare Images를 이용해 파일 저장과 이미지 변환 URL 생성을 제공하는 구현체입니다.
 */
@Component()
export class CloudflareImagesProvider extends BaseStorageProvider implements ImageProvider {
  private readonly options: CloudflareImagesOptions;
  private readonly imageBaseUrl: string;
  private readonly transformBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly ttl: number;

  constructor(options: CloudflareImagesOptions) {
    super();
    this.options = options;
    this.imageBaseUrl = options.customDomain
      ? `https://${options.customDomain}/cdn-cgi/imagedelivery`
      : "https://imagedelivery.net";
    this.transformBaseUrl = options.customDomain
      ? `https://${options.customDomain}`
      : "https://imagedelivery.net";
    this.apiBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/images/v1`;
    this.ttl = options.ttl ?? 3600;
    if (!Number.isFinite(this.ttl) || !Number.isInteger(this.ttl) || this.ttl <= 0) {
      throw ProblemFactory.internalServerError(
        "cloudflare/images-invalid-ttl",
        `Cloudflare Images TTL must be a positive finite integer, got: ${this.ttl}`,
      );
    }
  }

  async put(key: string, data: StorageBody, options?: PutOptions): Promise<void> {
    return await this.runCancellable(options, "put", key, async () => {
      this.validateKey(key);
      this.validateUploadImageId(key);

      const formData = new FormData();
      formData.append("id", key);

      let file: Blob;
      if (data instanceof Uint8Array) {
        file = new Blob([copyToArrayBuffer(data)], {
          type: options?.contentType ?? "application/octet-stream",
        });
      } else {
        const maxUploadBytes = this.options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
        const chunks: ArrayBuffer[] = [];
        let totalBytes = 0;

        const stream = this.bindOperationSignal(data, options, "put", key);
        for await (const chunk of stream) {
          totalBytes += chunk.byteLength;
          if (totalBytes > maxUploadBytes) {
            this.throwUploadFailed(
              key,
              `Cloudflare upload stream exceeds maxUploadBytes(${maxUploadBytes})`,
            );
          }

          chunks.push(copyToArrayBuffer(chunk));
        }

        file = new Blob(chunks, {
          type: options?.contentType ?? "application/octet-stream",
        });
      }

      formData.append("file", file, key);

      const response = await this.fetchCloudflare(this.apiBaseUrl, {
        init: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.apiToken}`,
          },
          body: formData,
        },
        key,
        operation: "put",
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw createCloudflareImagesResponseProblem({
          operation: "put",
          key,
          status: response.status,
          detail: `Cloudflare Images API error: ${errorText}`,
        });
      }

      const result = await this.parseCloudflareImagesResponse(response, key, "put");

      if (!result.success) {
        throw createCloudflareImagesResponseProblem({
          operation: "put",
          key,
          upstreamCode: "validation-failed",
          detail: `Cloudflare Images upload failed: ${result.errors.join(", ")}`,
        });
      }

      if (typeof result.result?.id !== "string" || result.result.id !== key) {
        throw new CloudflareImagesValidationProblem(
          {
            provider: "cloudflare-images",
            operation: "put",
            key,
            upstreamCode: "image-id-mismatch",
          },
          "Cloudflare Images upload response did not preserve the requested image id",
        );
      }
    });
  }

  async getStream(key: string, options?: StorageOperationOptions): Promise<StorageStream> {
    return await this.runCancellable(options, "getStream", key, async () => {
      this.validateKey(key);

      return await this.executeWithRetry(
        async () => {
          const response = await this.fetchCloudflare(
            `${this.buildManagementImageUrl(key, "get")}/blob`,
            {
              init: {
                headers: {
                  Authorization: `Bearer ${this.options.apiToken}`,
                },
              },
              key,
              operation: "get",
              signal: options?.signal,
            },
          );

          if (!response.ok) {
            await this.cancelResponseBody(response);

            if (response.status === 404) {
              this.throwNotFound(key);
            }

            throw createCloudflareImagesResponseProblem({
              operation: "get",
              key,
              status: response.status,
              ...retryAfterExtension(response),
            });
          }

          if (response.body === null) {
            throw normalizeCloudflareImagesError(
              { message: "Cloudflare response body is missing" },
              { key, operation: "get" },
            );
          }

          return await startDownloadStream(
            this.bindOperationSignal(response.body, options, "getStream", key),
            key,
          );
        },
        options,
        "getStream",
        key,
      );
    });
  }

  async delete(key: string, options?: StorageOperationOptions): Promise<void> {
    return await this.runCancellable(options, "delete", key, async () => {
      this.validateKey(key);

      await this.executeWithRetry(
        async () => {
          const response = await this.fetchCloudflare(this.buildManagementImageUrl(key, "delete"), {
            init: {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${this.options.apiToken}`,
              },
            },
            key,
            operation: "delete",
            signal: options?.signal,
          });

          if (!response.ok) {
            const errorText = await this.readErrorText(response);
            throw createCloudflareImagesResponseProblem({
              operation: "delete",
              key,
              status: response.status,
              ...retryAfterExtension(response),
              ...(errorText !== undefined && {
                detail: `Cloudflare Images delete error: ${errorText}`,
              }),
            });
          }

          const result = await this.readManagementResponse(response, key, "delete");

          if (!result.success) {
            throw createCloudflareImagesResponseProblem({
              operation: "delete",
              key,
              upstreamCode: "validation-failed",
              detail: `Cloudflare Images delete failed: ${result.errors.join(", ")}`,
            });
          }
        },
        options,
        "delete",
        key,
      );
    });
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    return this.buildImageUrl(key, this.options.defaultVariant ?? "public", "public-url");
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    return await this.runCancellable(options, "getSignedUrl", key, async () => {
      this.validateKey(key);
      const expiresIn = validateSignedUrlExpiry(options.expiresIn);

      const baseUrl = this.buildImageUrl(
        key,
        this.options.defaultVariant ?? "public",
        "signed-url",
      );
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

      const url = new URL(baseUrl);
      url.searchParams.set("exp", String(expiresAt));

      const signature = await this.generateSignature(
        key,
        `${url.pathname}?${url.searchParams.toString()}`,
      );

      url.searchParams.set("sig", signature);

      return url.toString();
    });
  }

  async getMetadata(
    key: string,
    options?: StorageOperationOptions,
  ): Promise<{ size: number; contentType?: string; lastModified: Date; etag?: string }> {
    return await this.runCancellable(options, "getMetadata", key, async () => {
      this.validateKey(key);

      return await this.executeWithRetry(
        async () => {
          const response = await this.fetchCloudflare(
            this.buildManagementImageUrl(key, "metadata"),
            {
              init: {
                headers: {
                  Authorization: `Bearer ${this.options.apiToken}`,
                },
              },
              key,
              operation: "metadata",
              signal: options?.signal,
            },
          );

          if (response.status === 404) {
            this.throwNotFound(key);
          }

          if (!response.ok) {
            const errorText = await this.readErrorText(response);
            throw createCloudflareImagesResponseProblem({
              operation: "metadata",
              key,
              status: response.status,
              ...retryAfterExtension(response),
              ...(errorText !== undefined && {
                detail: `Cloudflare Images metadata error: ${errorText}`,
              }),
            });
          }

          const result = await this.readManagementResponse<
            NonNullable<CloudflareImageDetails["result"]>
          >(response, key, "metadata");

          if (!result.success) {
            throw createCloudflareImagesResponseProblem({
              operation: "metadata",
              key,
              upstreamCode: "validation-failed",
              detail: `Cloudflare Images metadata failed: ${result.errors.join(", ")}`,
            });
          }

          if (!result.result) {
            throw ProblemFactory.internalServerError(
              "cloudflare/images-null-result",
              "Cloudflare Images API returned null result",
            );
          }

          const uploaded = result.result.uploaded;
          const lastModified = typeof uploaded === "string" ? new Date(uploaded) : undefined;
          if (!lastModified || Number.isNaN(lastModified.getTime())) {
            throw createCloudflareImagesResponseProblem({
              operation: "metadata",
              key,
              upstreamCode: "invalid-response",
              detail: "Cloudflare Images metadata response has an invalid uploaded timestamp",
            });
          }

          return {
            size: result.result.size ?? 0,
            lastModified,
          };
        },
        options,
        "getMetadata",
        key,
      );
    });
  }

  getTransformUrl(key: string, options: TransformOptions): string {
    this.validateKey(key);

    if (this.options.customDomain) {
      return this.buildTransformUrlCustomDomain(key, options);
    }

    return this.buildTransformUrlDefault(key, options);
  }

  async getUploadIntent(key: string, options?: UploadIntentOptions): Promise<UploadIntent> {
    return await this.runCancellable(options, "getUploadIntent", key, async () => {
      this.validateKey(key);
      this.validateDirectUploadImageId(key);

      const ttl = options?.ttlInSeconds ?? this.ttl;
      if (
        !Number.isFinite(ttl) ||
        !Number.isInteger(ttl) ||
        ttl < MIN_DIRECT_UPLOAD_TTL_SECONDS ||
        ttl > MAX_DIRECT_UPLOAD_TTL_SECONDS
      ) {
        throw ProblemFactory.invalidArgument(
          "storage/invalid-upload-intent-ttl",
          `ttlInSeconds must be an integer between ${MIN_DIRECT_UPLOAD_TTL_SECONDS} and ${MAX_DIRECT_UPLOAD_TTL_SECONDS}`,
        );
      }

      const upstreamTtl = Math.min(
        ttl + DIRECT_UPLOAD_EXPIRY_MARGIN_SECONDS,
        MAX_DIRECT_UPLOAD_TTL_SECONDS,
      );
      const expiresAt = new Date(Date.now() + upstreamTtl * 1000);
      const metadata = JSON.stringify({ originalKey: key });
      this.validateDirectUploadMetadata(key, metadata);
      const formData = new FormData();
      formData.append("id", key);
      formData.append("expiry", expiresAt.toISOString());
      formData.append("metadata", metadata);

      const url = `https://api.cloudflare.com/client/v4/accounts/${this.options.accountId}/images/v2/direct_upload`;

      const response = await this.fetchCloudflare(url, {
        init: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.apiToken}`,
          },
          body: formData,
        },
        key,
        operation: "upload-intent",
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw createCloudflareImagesResponseProblem({
          operation: "upload-intent",
          key,
          status: response.status,
          detail: `Cloudflare Images upload intent error: ${errorText}`,
        });
      }

      const result = await this.parseCloudflareImagesResponse(response, key, "upload-intent");

      if (!result.success) {
        throw createCloudflareImagesResponseProblem({
          operation: "upload-intent",
          key,
          upstreamCode: "validation-failed",
          detail: `Cloudflare Images upload intent failed: ${result.errors.join(", ")}`,
        });
      }

      if (!result.result) {
        throw ProblemFactory.internalServerError(
          "cloudflare/images-upload-intent-null-result",
          "Cloudflare Images API returned null result",
        );
      }

      const uploadUrl = result.result.uploadURL;
      const imageId = result.result.id;
      if (
        typeof uploadUrl !== "string" ||
        uploadUrl.length === 0 ||
        typeof imageId !== "string" ||
        imageId !== key ||
        !this.isCloudflareUploadUrl(uploadUrl)
      ) {
        this.throwInvalidCloudflareImagesResponse(key, "upload-intent");
      }

      const publicUrl = this.buildImageUrl(
        imageId,
        this.options.defaultVariant ?? "public",
        "upload-intent",
      );
      return {
        uploadUrl,
        publicUrl,
        expiresAt,
      };
    });
  }

  private isCloudflareUploadUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return (
        url.origin === CLOUDFLARE_UPLOAD_ORIGIN &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === "" &&
        /^\/[^/]+\/[^/]+$/.test(url.pathname)
      );
    } catch {
      return false;
    }
  }

  private async cancelResponseBody(response: Response): Promise<void> {
    try {
      await response.body?.cancel();
    } catch (cancellationError: unknown) {
      // Preserve the response status Problem when best-effort cleanup fails.
      void cancellationError;
    }
  }

  private async readErrorText(response: Response): Promise<string | undefined> {
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }

  private async readManagementResponse<TResult extends object = Record<string, unknown>>(
    response: Response,
    key: string,
    operation: string,
  ): Promise<CloudflareImagesRuntimeResponse<TResult>> {
    return await this.parseCloudflareImagesResponse<TResult>(response, key, operation);
  }

  private validateDirectUploadImageId(key: string): void {
    this.validateUploadImageId(key, "upload-intent");

    if (UUID_IMAGE_ID_PATTERN.test(key)) {
      throw new CloudflareImagesValidationProblem(
        {
          provider: "cloudflare-images",
          operation: "upload-intent",
          key,
          upstreamCode: "image-id-uuid",
        },
        "Cloudflare Images direct-upload custom id must not be a UUID",
      );
    }
  }

  private validateDirectUploadMetadata(key: string, metadata: string): void {
    if (Buffer.byteLength(metadata, "utf8") <= MAX_DIRECT_UPLOAD_METADATA_BYTES) {
      return;
    }

    throw new CloudflareImagesValidationProblem(
      {
        provider: "cloudflare-images",
        operation: "upload-intent",
        key,
        upstreamCode: "metadata-too-large",
      },
      `Cloudflare Images direct-upload metadata must not exceed ${MAX_DIRECT_UPLOAD_METADATA_BYTES} bytes`,
    );
  }

  private buildImageUrl(key: string, variant: string, operation: string): string {
    return `${this.imageBaseUrl}/${this.options.accountHash}/${this.encodeDeliveryImageId(key, operation)}/${variant}`;
  }

  private buildManagementImageUrl(key: string, operation: string): string {
    this.validateImageId(key, operation);
    return `${this.apiBaseUrl}/${encodeURIComponent(key)}`;
  }

  private buildTransformUrlDefault(key: string, options: TransformOptions): string {
    const transformOptions = this.toCloudflareTransformOptions(options);
    const params = this.buildTransformParams(transformOptions);

    if (params.length === 0) {
      return this.buildImageUrl(key, this.options.defaultVariant ?? "public", "transform-url");
    }

    return this.buildTransformUrl(key, params);
  }

  private buildTransformUrlCustomDomain(key: string, options: TransformOptions): string {
    const transformOptions = this.toCloudflareTransformOptions(options);
    const params = this.buildTransformParams(transformOptions);

    if (params.length === 0) {
      return this.buildImageUrl(key, this.options.defaultVariant ?? "public", "transform-url");
    }

    return this.buildTransformUrl(key, params);
  }

  private buildTransformUrl(key: string, params: string): string {
    return `${this.transformBaseUrl}/cdn-cgi/image/${params}/${this.options.accountHash}/${this.encodeDeliveryImageId(key, "transform-url")}/${this.options.defaultVariant ?? "public"}`;
  }

  private encodeDeliveryImageId(key: string, operation: string): string {
    this.validateImageId(key, operation);
    return key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  private validateUploadImageId(key: string, operation = "put"): void {
    this.validateImageId(key, operation);

    if (Array.from(key).length <= MAX_CLOUDFLARE_IMAGE_ID_CODE_POINTS) {
      return;
    }

    throw new CloudflareImagesValidationProblem(
      {
        provider: "cloudflare-images",
        operation,
        key,
        upstreamCode: "image-id-too-long",
      },
      `Cloudflare Images image id must not exceed ${MAX_CLOUDFLARE_IMAGE_ID_CODE_POINTS} Unicode code points`,
    );
  }

  private validateImageId(key: string, operation: string): void {
    this.validateImageIdUnicode(key, operation);

    if (key.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new CloudflareImagesValidationProblem(
        {
          provider: "cloudflare-images",
          operation,
          key,
          upstreamCode: "image-id-dot-segment",
        },
        "Cloudflare Images image id must not contain dot path segments",
      );
    }
  }

  private validateImageIdUnicode(key: string, operation: string): void {
    for (let index = 0; index < key.length; index += 1) {
      const codeUnit = key.charCodeAt(index);

      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const nextCodeUnit = key.charCodeAt(index + 1);
        if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
          index += 1;
          continue;
        }

        this.throwInvalidImageIdUnicode(key, operation);
      }

      if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        this.throwInvalidImageIdUnicode(key, operation);
      }
    }
  }

  private throwInvalidImageIdUnicode(key: string, operation: string): never {
    throw new CloudflareImagesValidationProblem(
      {
        provider: "cloudflare-images",
        operation,
        key,
        upstreamCode: "image-id-invalid-unicode",
      },
      "Cloudflare Images image id must contain well-formed Unicode",
    );
  }

  private async parseCloudflareImagesResponse<TResult extends object = Record<string, unknown>>(
    response: Response,
    key: string,
    operation: string,
  ): Promise<CloudflareImagesRuntimeResponse<TResult>> {
    let value: unknown;
    try {
      value = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.throwInvalidCloudflareImagesResponse(key, operation);
      }
      throw normalizeCloudflareImagesError(error, { key, operation });
    }

    if (!isRecord(value) || typeof value.success !== "boolean") {
      return this.throwInvalidCloudflareImagesResponse(key, operation);
    }

    const errors = value.errors;
    if (!Array.isArray(errors) || !errors.every((error) => typeof error === "string")) {
      return this.throwInvalidCloudflareImagesResponse(key, operation);
    }

    const result = value.result;
    if (result !== undefined && result !== null && !isRecord(result)) {
      return this.throwInvalidCloudflareImagesResponse(key, operation);
    }

    return {
      errors,
      success: value.success,
      ...(result !== undefined && { result: result as TResult | null }),
    };
  }

  private throwInvalidCloudflareImagesResponse(key: string, operation: string): never {
    throw createCloudflareImagesResponseProblem({
      operation,
      key,
      upstreamCode: "invalid-response",
      detail: "Cloudflare Images API returned an invalid response",
    });
  }

  private buildTransformParams(options: CloudflareTransformOptions): string {
    const params: string[] = [];

    if (options.width !== undefined) {
      params.push(`width=${options.width}`);
    }

    if (options.height !== undefined) {
      params.push(`height=${options.height}`);
    }

    if (options.fit !== undefined) {
      params.push(`fit=${options.fit}`);
    }

    if (options.quality !== undefined) {
      params.push(`quality=${options.quality}`);
    }

    if (options.format !== undefined) {
      params.push(`format=${options.format}`);
    }

    if (options.dpr !== undefined) {
      params.push(`dpr=${options.dpr}`);
    }

    if (options.sharpen !== undefined) {
      params.push(`sharpen=${options.sharpen}`);
    }

    if (options.blur !== undefined) {
      params.push(`blur=${options.blur}`);
    }

    if (options.rotate !== undefined) {
      params.push(`rotate=${options.rotate}`);
    }

    if (options.grayscale !== undefined && options.grayscale) {
      params.push("grayscale=true");
    }

    if (options.invert !== undefined && options.invert) {
      params.push("invert=true");
    }

    return params.join(",");
  }

  private toCloudflareTransformOptions(options: TransformOptions): CloudflareTransformOptions {
    const transformOptions: CloudflareTransformOptions = {};

    if (options.width !== undefined) {
      transformOptions.width = options.width;
    }

    if (options.height !== undefined) {
      transformOptions.height = options.height;
    }

    if (options.fit !== undefined) {
      transformOptions.fit = this.mapFitMode(options.fit);
    }

    if (options.quality !== undefined) {
      transformOptions.quality = options.quality;
    }

    if (options.format !== undefined && options.format !== "auto") {
      transformOptions.format = this.mapFormat(options.format);
    }

    if (options.dpr !== undefined) {
      transformOptions.dpr = options.dpr;
    }

    return transformOptions;
  }

  private mapFitMode(
    fit: "cover" | "contain" | "fill" | "inside" | "outside",
  ): CloudflareTransformOptions["fit"] {
    switch (fit) {
      case "cover":
        return "cover";
      case "contain":
        return "contain";
      case "fill":
        return "fill";
      case "inside":
        return "scale-down";
      case "outside":
        return "cover";
      default:
        return undefined;
    }
  }

  private mapFormat(
    format: "webp" | "avif" | "jpg" | "png" | "auto",
  ): CloudflareTransformOptions["format"] {
    switch (format) {
      case "jpg":
        return "jpeg";
      case "webp":
      case "avif":
      case "png":
        return format;
      case "auto":
        return undefined;
      default:
        return undefined;
    }
  }

  private async generateSignature(key: string, urlPath: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(urlPath);

    const signature = await crypto.subtle.sign("HMAC", await this.getSigningKey(key), data);

    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return signatureHex;
  }

  private async getSigningKey(key: string): Promise<CryptoKey> {
    const { signingKey } = this.options;
    if (!signingKey) {
      throw createCloudflareImagesResponseProblem({
        operation: "signed-url",
        key,
        upstreamCode: "missing-signing-key",
        detail: "Cloudflare signingKey is required for signed URL generation",
      });
    }

    const keyData = new TextEncoder().encode(signingKey);

    return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
  }

  private async fetchCloudflare(
    input: string,
    options: {
      readonly init?: RequestInit;
      readonly key: string;
      readonly operation: string;
      readonly signal?: AbortSignal;
    },
  ): Promise<Response> {
    try {
      const init =
        options.signal === undefined
          ? options.init
          : {
              ...options.init,
              signal: options.signal,
            };
      return init === undefined ? await fetch(input) : await fetch(input, init);
    } catch (error) {
      throw normalizeCloudflareImagesError(error, {
        key: options.key,
        operation: options.operation,
      });
    }
  }

  private async executeWithRetry<T>(
    execute: () => Promise<T>,
    options: StorageOperationOptions | undefined,
    operation: StorageOperation,
    key: string,
  ): Promise<T> {
    const retryDelay: RetryDelayState = {};
    const retryMaxDelay = this.options.retryBackoff?.maxDelay ?? DEFAULT_RETRY_MAX_DELAY_MS;
    const retryTemplate = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new RetryAfterBackoff(this.options.retryBackoff, retryDelay),
      retryPolicy: createCloudflareImagesRetryPolicy(retryMaxDelay, retryDelay),
      signal: options?.signal,
    });

    return await retryTemplate.execute(async () => {
      this.assertOperationNotAborted(options, operation, key);
      try {
        const result = await execute();
        this.assertOperationNotAborted(options, operation, key);
        return result;
      } catch (error) {
        this.rethrowOperationAbort(error, options, operation, key);
        throw error;
      }
    });
  }

  private async runCancellable<T>(
    options: StorageOperationOptions | undefined,
    operation: StorageOperation,
    key: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    this.assertOperationNotAborted(options, operation, key);

    try {
      const result = await execute();
      this.assertOperationNotAborted(options, operation, key);
      return result;
    } catch (error) {
      this.rethrowOperationAbort(error, options, operation, key);
      throw error;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
