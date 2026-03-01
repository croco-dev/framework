import type { Readable } from 'node:stream';
import { Component } from '@croco/framework-context';
import type { ImageProvider, PutOptions, SignedUrlOptions, TransformOptions, UploadIntent } from '@croco/storage-core';
import { BaseStorageProvider } from '@croco/storage-core';
import type {
  CloudflareImageDetails,
  CloudflareImagesOptions,
  CloudflareTransformOptions,
  CloudflareUploadResponse,
} from './types';

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Component()
export class CloudflareImagesProvider extends BaseStorageProvider implements ImageProvider {
  private readonly options: CloudflareImagesOptions;
  private readonly baseUrl: string;
  private readonly apiBaseUrl: string;

  constructor(options: CloudflareImagesOptions) {
    super();
    this.options = options;
    this.baseUrl = options.customDomain
      ? `https://${options.customDomain}/cdn-cgi/imagedelivery`
      : `https://imagedelivery.net`;
    this.apiBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/images/v1`;
  }

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);

    const formData = new FormData();

    let file: File | Blob;
    if (Buffer.isBuffer(data)) {
      const uint8Array = new Uint8Array(data);
      file = new File([uint8Array], key, { type: options?.contentType ?? 'application/octet-stream' });
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
        } else if (typeof chunk === 'string') {
          bufferChunk = Buffer.from(chunk);
        } else {
          this.throwUploadFailed(key, 'Cloudflare upload stream contains unsupported chunk type');
        }

        totalBytes += bufferChunk.length;
        if (totalBytes > maxUploadBytes) {
          this.throwUploadFailed(key, `Cloudflare upload stream exceeds maxUploadBytes(${maxUploadBytes})`);
        }

        chunks.push(bufferChunk);
      }

      const buffer = Buffer.concat(chunks);
      const uint8Array = new Uint8Array(buffer);
      file = new File([uint8Array], key, { type: options?.contentType ?? 'application/octet-stream' });
    }

    formData.append('file', file);

    const response = await fetch(this.apiBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.throwUploadFailed(key, `Cloudflare API error: ${errorText}`);
    }

    const result = (await response.json()) as CloudflareUploadResponse;

    if (!result.success) {
      this.throwUploadFailed(key, `Cloudflare upload failed: ${result.errors.join(', ')}`);
    }
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const url = this.buildImageUrl(key, this.options.defaultVariant ?? 'public');
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        this.throwNotFound(key);
      }

      this.throwUploadFailed(key, `Failed to fetch image: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    const response = await fetch(`${this.apiBaseUrl}/${key}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.options.apiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.throwDeleteFailed(key, `Cloudflare delete error: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      this.throwDeleteFailed(key, `Cloudflare delete failed: ${result.errors.join(', ')}`);
    }
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    return this.buildImageUrl(key, this.options.defaultVariant ?? 'public');
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);

    const url = this.buildImageUrl(key, this.options.defaultVariant ?? 'public');

    const expiresAt = Math.floor(Date.now() / 1000) + options.expiresIn;

    const signature = await this.generateSignature(key, expiresAt);

    return `${url}?expires=${expiresAt}&signature=${signature}`;
  }

  async getMetadata(key: string): Promise<{ size: number; contentType?: string; lastModified: Date; etag?: string }> {
    this.validateKey(key);

    const response = await fetch(`${this.apiBaseUrl}/${key}`, {
      headers: {
        Authorization: `Bearer ${this.options.apiToken}`,
      },
    });

    if (response.status === 404) {
      this.throwNotFound(key);
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.throwUploadFailed(key, `Cloudflare metadata error: ${errorText}`);
    }

    const result = (await response.json()) as CloudflareImageDetails;

    if (!result.success) {
      this.throwUploadFailed(key, `Cloudflare metadata failed: ${result.errors.join(', ')}`);
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

  async getUploadIntent(key: string): Promise<UploadIntent> {
    this.validateKey(key);

    const url = `${this.apiBaseUrl}/direct_upload`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: 3600,
        metadata: {
          originalKey: key,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.throwUploadFailed(key, `Cloudflare upload intent error: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      this.throwUploadFailed(key, `Cloudflare upload intent failed: ${result.errors.join(', ')}`);
    }

    const uploadUrl = result.result.uploadURL;
    const publicUrl = this.buildImageUrl(result.result.id, this.options.defaultVariant ?? 'public');
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return {
      uploadUrl,
      publicUrl,
      expiresAt,
    };
  }

  private buildImageUrl(key: string, variant: string): string {
    return `${this.baseUrl}/${this.options.accountHash}/${key}/${variant}`;
  }

  private buildTransformUrlDefault(key: string, options: TransformOptions): string {
    const transformOptions = this.toCloudflareTransformOptions(options);
    const params = this.buildTransformParams(transformOptions);

    if (params.length === 0) {
      return this.buildImageUrl(key, this.options.defaultVariant ?? 'public');
    }

    return `${this.baseUrl}/${this.options.accountHash}/${key}/cdn-cgi/image/${params}`;
  }

  private buildTransformUrlCustomDomain(key: string, options: TransformOptions): string {
    const transformOptions = this.toCloudflareTransformOptions(options);
    const params = this.buildTransformParams(transformOptions);

    if (params.length === 0) {
      return this.buildImageUrl(key, this.options.defaultVariant ?? 'public');
    }

    return `https://${this.options.customDomain}/cdn-cgi/image/${params}/${this.options.accountHash}/${key}`;
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
      params.push('grayscale=true');
    }

    if (options.invert !== undefined && options.invert) {
      params.push('invert=true');
    }

    return params.join(',');
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

    if (options.format !== undefined && options.format !== 'auto') {
      transformOptions.format = this.mapFormat(options.format);
    }

    if (options.dpr !== undefined) {
      transformOptions.dpr = options.dpr;
    }

    return transformOptions;
  }

  private mapFitMode(fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'): CloudflareTransformOptions['fit'] {
    switch (fit) {
      case 'cover':
        return 'cover';
      case 'contain':
        return 'contain';
      case 'fill':
        return 'fill';
      case 'inside':
        return 'scale-down';
      case 'outside':
        return 'cover';
      default:
        return undefined;
    }
  }

  private mapFormat(format: 'webp' | 'avif' | 'jpg' | 'png' | 'auto'): CloudflareTransformOptions['format'] {
    switch (format) {
      case 'jpg':
        return 'jpeg';
      case 'webp':
      case 'avif':
      case 'png':
        return format;
      case 'auto':
        return undefined;
      default:
        return undefined;
    }
  }

  private async generateSignature(key: string, expiresAt: number): Promise<string> {
    const text = `${key}:${expiresAt}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const signature = await crypto.subtle.sign('HMAC', await this.getSigningKey(), data);

    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return signatureHex;
  }

  private async getSigningKey(): Promise<CryptoKey> {
    const keyData = new TextEncoder().encode(this.options.apiToken);

    return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }
}
