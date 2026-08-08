import type { Readable } from "node:stream";
import { Component } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import type { RetryPolicy } from "@croco/retry-core";
import { RetryTemplate } from "@croco/retry-core";
import type {
  ImageProvider,
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  TransformOptions,
  UploadIntent,
} from "@croco/storage-core";
import { BaseStorageProvider, validateSignedUrlExpiry } from "@croco/storage-core";
import { v2 as cloudinary } from "cloudinary";
import {
  CloudinaryTerminalUpstreamProblem,
  getCloudinaryErrorMessage,
  isRetryableCloudinaryStorageError,
  normalizeCloudinaryStorageError,
} from "./CloudinaryDiagnosticsProvider";
import type { CloudinaryConfig, CloudinaryTransformOptions } from "./types";

const CLOUDINARY_RETRY_POLICY: RetryPolicy = {
  shouldRetry(error: unknown, attempt: number, maxAttempts: number) {
    if (attempt >= maxAttempts) {
      return false;
    }

    return isRetryableCloudinaryStorageError(error);
  },
};

type CloudinarySdkError = Error & {
  code?: string;
  http_code?: number;
  status?: number;
  statusCode?: number;
};

function toCloudinarySdkError(error: unknown, fallbackMessage: string): CloudinarySdkError {
  if (error instanceof Error) {
    return error as CloudinarySdkError;
  }

  const sdkError = new Error(
    getCloudinaryErrorMessage(error, fallbackMessage),
  ) as CloudinarySdkError;
  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : undefined;
  const nestedError =
    typeof record?.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : undefined;

  const code = firstString(
    record?.code,
    record?.name,
    nestedError?.code,
    nestedError?.name,
    typeof record?.error === "string" ? record.error : undefined,
  );
  if (code !== undefined) {
    sdkError.code = code;
  }

  const status = firstNumber(
    record?.http_code,
    record?.status,
    record?.statusCode,
    nestedError?.http_code,
    nestedError?.status,
    nestedError?.statusCode,
  );
  if (status !== undefined) {
    sdkError.http_code = status;
    sdkError.status = status;
    sdkError.statusCode = status;
  }

  return sdkError;
}

function firstNumber(...values: readonly unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function firstString(...values: readonly unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

/**
 * Cloudinary를 이용해 파일 저장과 이미지 변환 URL 생성을 제공하는 구현체입니다.
 */
@Component()
export class CloudinaryProvider extends BaseStorageProvider implements ImageProvider {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly secure: boolean;
  private readonly uploadBaseUrl: string;
  private readonly retryTemplate: RetryTemplate;
  private readonly ttl: number;

  constructor(config: CloudinaryConfig) {
    super();
    this.cloudName = config.cloudName;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.secure = config.secure ?? true;
    this.uploadBaseUrl = config.uploadBaseUrl ?? "https://api.cloudinary.com";
    this.ttl = config.ttl ?? 3600;
    if (!Number.isFinite(this.ttl) || !Number.isInteger(this.ttl) || this.ttl <= 0) {
      this.ttl = 3600;
    }
    this.retryTemplate = new RetryTemplate({
      maxAttempts: 3,
      backoff: {
        delay: 10,
        multiplier: 2,
        maxDelay: 50,
        jitter: false,
      },
      retryPolicy: CLOUDINARY_RETRY_POLICY,
    });
  }

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);

    const uploadOptions: Record<string, unknown> = {
      public_id: key,
      resource_type: this.inferResourceType(options?.contentType),
    };

    if (options?.metadata) {
      uploadOptions.context = this.formatContext(options.metadata);
    }

    const upload = async () => {
      await this.withConfiguredCloudinary(async () => {
        await new Promise<void>((resolve, reject) => {
          let uploadStream: ReturnType<typeof cloudinary.uploader.upload_stream>;

          try {
            uploadStream = cloudinary.uploader.upload_stream(
              uploadOptions,
              (error: unknown, _result: unknown) => {
                if (error) {
                  reject(toCloudinarySdkError(error, "Unknown Cloudinary upload error"));
                  return;
                }

                resolve();
              },
            );
          } catch (error) {
            reject(toCloudinarySdkError(error, "Unknown Cloudinary upload error"));
            return;
          }

          if (Buffer.isBuffer(data)) {
            uploadStream.end(data);
            return;
          }

          data.once("error", (error) => {
            reject(error);
          });

          data.pipe(uploadStream);
        });
      });
    };

    const uploadPromise = Buffer.isBuffer(data) ? this.executeWithRetry(upload) : upload();

    return uploadPromise.catch((error) => {
      throw normalizeCloudinaryStorageError(error, { key, operation: "put" });
    });
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const url = this.buildDeliveryUrl(key, "image");

    try {
      const response = await this.executeWithRetry(async () => {
        const fetchedResponse = await fetch(url);

        if (!fetchedResponse.ok) {
          if (fetchedResponse.status === 404) {
            this.throwNotFound(key);
          }

          throw normalizeCloudinaryStorageError(
            {
              message: `Failed to fetch file: HTTP ${fetchedResponse.status}`,
              status: fetchedResponse.status,
            },
            { key, operation: "get", status: fetchedResponse.status },
          );
        }

        return fetchedResponse;
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw normalizeCloudinaryStorageError(error, { key, operation: "get" });
    }
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    try {
      const result = await this.executeWithRetry(
        async () =>
          await this.executeCloudinaryOperation(
            async () =>
              await cloudinary.uploader.destroy(key, {
                resource_type: "image",
              }),
          ),
      );

      if (result.result !== "ok" && result.result !== "not found") {
        throw new CloudinaryTerminalUpstreamProblem({
          provider: "cloudinary",
          operation: "delete",
          key,
          upstreamCode: result.result,
        });
      }
    } catch (error) {
      throw normalizeCloudinaryStorageError(error, { key, operation: "delete" });
    }
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);
    return cloudinary.url(key, {
      cloud_name: this.cloudName,
      secure: this.secure,
    });
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);
    const expiresIn = validateSignedUrlExpiry(options.expiresIn);

    const url = cloudinary.url(key, {
      cloud_name: this.cloudName,
      api_secret: this.apiSecret,
      secure: this.secure,
      sign_url: true,
      expiration: Math.floor(Date.now() / 1000) + expiresIn,
    });

    return url;
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    this.validateKey(key);

    try {
      const resource = (await this.executeWithRetry(
        async () =>
          await this.executeCloudinaryOperation(
            async () =>
              await cloudinary.api.resource(key, {
                resource_type: "image",
              }),
          ),
      )) as {
        bytes?: number;
        format?: string;
        created_at: string;
        etag?: string;
        context?: unknown;
      };

      return {
        size: resource.bytes ?? 0,
        contentType: resource.format,
        lastModified: new Date(resource.created_at),
        etag: resource.etag,
        metadata: resource.context ? this.parseContext(resource.context) : undefined,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        this.throwNotFound(key);
      }

      throw normalizeCloudinaryStorageError(error, { key, operation: "metadata" });
    }
  }

  getTransformUrl(key: string, options: TransformOptions): string {
    this.validateKey(key);

    const transformOptions = this.toCloudinaryTransformOptions(options);
    const params = this.buildTransformParams(transformOptions);

    return cloudinary.url(key, {
      cloud_name: this.cloudName,
      secure: this.secure,
      transformation: params,
    });
  }

  async getUploadIntent(key: string, options?: { ttlInSeconds?: number }): Promise<UploadIntent> {
    this.validateKey(key);

    const ttl = options?.ttlInSeconds ?? this.ttl;
    if (!Number.isFinite(ttl) || !Number.isInteger(ttl) || ttl <= 0) {
      throw ProblemFactory.invalidArgument(
        "storage-cloudinary/invalid-upload-intent-ttl",
        "ttlInSeconds must be a positive finite integer",
      );
    }

    const uploadUrl = new URL(
      `/v1_1/${this.cloudName}/image/upload`,
      this.uploadBaseUrl,
    ).toString();
    const publicUrl = this.getPublicUrl(key);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      uploadUrl,
      publicUrl,
      expiresAt,
    };
  }

  private buildDeliveryUrl(key: string, resourceType: string): string {
    const protocol = this.secure ? "https" : "http";
    return `${protocol}://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${key}`;
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return await this.retryTemplate.execute(async () => await operation());
  }

  private async executeCloudinaryOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.withConfiguredCloudinary(operation);
    } catch (error) {
      throw toCloudinarySdkError(error, "Unknown Cloudinary error");
    }
  }

  private getCloudinaryConfig() {
    return {
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: this.secure,
    };
  }

  private async withConfiguredCloudinary<T>(operation: () => Promise<T>): Promise<T> {
    const previousConfig = { ...cloudinary.config() };

    cloudinary.config(this.getCloudinaryConfig());

    try {
      return await operation();
    } finally {
      cloudinary.config(previousConfig);
    }
  }

  private buildTransformParams(options: CloudinaryTransformOptions): string | undefined {
    const params: string[] = [];

    if (options.width !== undefined) {
      params.push(`w_${options.width}`);
    }

    if (options.height !== undefined) {
      params.push(`h_${options.height}`);
    }

    if (options.crop !== undefined) {
      params.push(`c_${options.crop}`);
    }

    if (options.quality !== undefined) {
      params.push(`q_${options.quality}`);
    }

    if (options.format !== undefined) {
      params.push(`f_${options.format}`);
    }

    if (options.dpr !== undefined) {
      params.push(`dpr_${options.dpr}`);
    }

    return params.length > 0 ? params.join(",") : undefined;
  }

  private toCloudinaryTransformOptions(options: TransformOptions): CloudinaryTransformOptions {
    const transformOptions: CloudinaryTransformOptions = {};

    if (options.width !== undefined) {
      transformOptions.width = options.width;
    }

    if (options.height !== undefined) {
      transformOptions.height = options.height;
    }

    if (options.fit !== undefined) {
      transformOptions.crop = this.mapFitMode(options.fit);
    }

    if (options.quality !== undefined) {
      transformOptions.quality = options.quality;
    }

    if (options.format !== undefined && options.format !== "auto") {
      transformOptions.format = options.format;
    }

    if (options.dpr !== undefined) {
      transformOptions.dpr = options.dpr;
    }

    return transformOptions;
  }

  private mapFitMode(
    fit: "cover" | "contain" | "fill" | "inside" | "outside",
  ): CloudinaryTransformOptions["crop"] {
    switch (fit) {
      case "cover":
        return "fill";
      case "contain":
        return "fit";
      case "fill":
        return "pad";
      case "inside":
        return "limit";
      case "outside":
        return "crop";
      default:
        return undefined;
    }
  }

  private inferResourceType(contentType?: string): string {
    if (!contentType) {
      return "auto";
    }

    if (contentType.startsWith("image/")) {
      return "image";
    }

    if (contentType.startsWith("video/")) {
      return "video";
    }

    return "raw";
  }

  private formatContext(metadata: Record<string, string>): string {
    return Object.entries(metadata)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("|");
  }

  private parseContext(context: unknown): Record<string, string> {
    if (typeof context === "string") {
      return context.split("|").reduce<Record<string, string>>((acc, pair) => {
        const separatorIndex = pair.indexOf("=");

        if (separatorIndex === -1) {
          return acc;
        }

        const rawKey = pair.slice(0, separatorIndex);
        const rawValue = pair.slice(separatorIndex + 1);

        acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
        return acc;
      }, {});
    }

    if (context && typeof context === "object" && "custom" in context) {
      const custom = Reflect.get(context, "custom");
      if (custom && typeof custom === "object") {
        return Object.entries(custom).reduce<Record<string, string>>((acc, [key, value]) => {
          if (typeof value === "string") {
            acc[decodeURIComponent(key)] = decodeURIComponent(value);
          }

          return acc;
        }, {});
      }
    }

    if (context && typeof context === "object") {
      return Object.entries(context).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === "string") {
          acc[decodeURIComponent(key)] = decodeURIComponent(value);
        }

        return acc;
      }, {});
    }

    return {};
  }

  private isNotFoundError(error: unknown): boolean {
    if (typeof error === "object" && error !== null && Reflect.get(error, "http_code") === 404) {
      return true;
    }

    if (typeof error === "object" && error !== null && Reflect.get(error, "status") === 404) {
      return true;
    }

    if (typeof error === "object" && error !== null && Reflect.get(error, "statusCode") === 404) {
      return true;
    }

    const message = getCloudinaryErrorMessage(error, "").toLowerCase();
    return message.includes("not found");
  }
}
