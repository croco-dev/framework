import type { Readable } from "node:stream";
import { Component } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import type {
  ImageProvider,
  PutOptions,
  SignedUrlOptions,
  TransformOptions,
  UploadIntent,
} from "@croco/storage-core";
import { BaseStorageProvider, validateSignedUrlExpiry } from "@croco/storage-core";
import {
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

type CloudflareImagesRuntimeResponse = {
  readonly errors: string[];
  readonly result?: Record<string, unknown> | null;
  readonly success: boolean;
};

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

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);
    this.validateUploadImageId(key);

    const formData = new FormData();
    formData.append("id", key);

    let file: File | Blob;
    if (Buffer.isBuffer(data)) {
      const uint8Array = new Uint8Array(data);
      file = new File([uint8Array], key, {
        type: options?.contentType ?? "application/octet-stream",
      });
    } else {
      const maxUploadBytes = this.options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      for await (const chunk of data) {
        let bufferChunk: Buffer;
        if (Buffer.isBuffer(chunk)) {
          bufferChunk = chunk;
        } else if (chunk instanceof Uint8Array) {
          bufferChunk = Buffer.from(chunk);
        } else if (chunk instanceof ArrayBuffer) {
          bufferChunk = Buffer.from(chunk);
        } else if (typeof chunk === "string") {
          bufferChunk = Buffer.from(chunk);
        } else {
          this.throwUploadFailed(key, "Cloudflare upload stream contains unsupported chunk type");
        }

        totalBytes += bufferChunk.length;
        if (totalBytes > maxUploadBytes) {
          this.throwUploadFailed(
            key,
            `Cloudflare upload stream exceeds maxUploadBytes(${maxUploadBytes})`,
          );
        }

        chunks.push(bufferChunk);
      }

      const buffer = Buffer.concat(chunks);
      const uint8Array = new Uint8Array(buffer);
      file = new File([uint8Array], key, {
        type: options?.contentType ?? "application/octet-stream",
      });
    }

    formData.append("file", file);

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
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const url = this.buildImageUrl(key, this.options.defaultVariant ?? "public", "get");
    const response = await this.fetchCloudflare(url, { key, operation: "get" });

    if (!response.ok) {
      if (response.status === 404) {
        this.throwNotFound(key);
      }

      throw createCloudflareImagesResponseProblem({
        operation: "get",
        key,
        status: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    const response = await this.fetchCloudflare(this.buildManagementImageUrl(key, "delete"), {
      init: {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.options.apiToken}`,
        },
      },
      key,
      operation: "delete",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createCloudflareImagesResponseProblem({
        operation: "delete",
        key,
        status: response.status,
        detail: `Cloudflare Images delete error: ${errorText}`,
      });
    }

    const result = await response.json();

    if (!result.success) {
      throw createCloudflareImagesResponseProblem({
        operation: "delete",
        key,
        upstreamCode: "validation-failed",
        detail: `Cloudflare Images delete failed: ${result.errors.join(", ")}`,
      });
    }
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    return this.buildImageUrl(key, this.options.defaultVariant ?? "public", "public-url");
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);
    const expiresIn = validateSignedUrlExpiry(options.expiresIn);

    const url = this.buildImageUrl(key, this.options.defaultVariant ?? "public", "signed-url");

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const signature = await this.generateSignature(key, expiresAt);

    return `${url}?expires=${expiresAt}&signature=${signature}`;
  }

  async getMetadata(
    key: string,
  ): Promise<{ size: number; contentType?: string; lastModified: Date; etag?: string }> {
    this.validateKey(key);

    const response = await this.fetchCloudflare(this.buildManagementImageUrl(key, "metadata"), {
      init: {
        headers: {
          Authorization: `Bearer ${this.options.apiToken}`,
        },
      },
      key,
      operation: "metadata",
    });

    if (response.status === 404) {
      this.throwNotFound(key);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw createCloudflareImagesResponseProblem({
        operation: "metadata",
        key,
        status: response.status,
        detail: `Cloudflare Images metadata error: ${errorText}`,
      });
    }

    const result = (await response.json()) as CloudflareImageDetails;

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

    return {
      size: result.result.size ?? 0,
      lastModified: new Date(result.result.uploaded),
    };
  }

  getTransformUrl(key: string, options: TransformOptions): string {
    this.validateKey(key);

    if (this.options.customDomain) {
      return this.buildTransformUrlCustomDomain(key, options);
    }

    return this.buildTransformUrlDefault(key, options);
  }

  async getUploadIntent(key: string, options?: { ttlInSeconds?: number }): Promise<UploadIntent> {
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

  private async parseCloudflareImagesResponse(
    response: Response,
    key: string,
    operation: string,
  ): Promise<CloudflareImagesRuntimeResponse> {
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return this.throwInvalidCloudflareImagesResponse(key, operation);
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
      ...(result !== undefined && { result }),
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

  private async generateSignature(key: string, expiresAt: number): Promise<string> {
    const text = `${key}:${expiresAt}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

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
    },
  ): Promise<Response> {
    try {
      return options.init === undefined ? await fetch(input) : await fetch(input, options.init);
    } catch (error) {
      throw normalizeCloudflareImagesError(error, {
        key: options.key,
        operation: options.operation,
      });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
