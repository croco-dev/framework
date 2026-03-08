import type { Readable } from 'node:stream';
import { Component } from '@croco/framework-context';
import type {
  ImageProvider,
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  TransformOptions,
  UploadIntent,
} from '@croco/storage-core';
import { BaseStorageProvider } from '@croco/storage-core';
import { v2 as cloudinary } from 'cloudinary';
import type { CloudinaryConfig, CloudinaryTransformOptions } from './types';

@Component()
export class CloudinaryProvider extends BaseStorageProvider implements ImageProvider {
  private static operationInFlight = false;
  private static operationWaiters: Array<() => void> = [];

  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly secure: boolean;
  private readonly uploadBaseUrl: string;

  constructor(config: CloudinaryConfig) {
    super();
    this.cloudName = config.cloudName;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.secure = config.secure ?? true;
    this.uploadBaseUrl = config.uploadBaseUrl ?? 'https://api.cloudinary.com';
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

    return this.withConfiguredCloudinary(async () => {
      await new Promise<void>((resolve, reject) => {
        let uploadStream: ReturnType<typeof cloudinary.uploader.upload_stream>;

        try {
          uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error: Error | undefined, _result: unknown) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            }
          );
        } catch (error) {
          reject(error);
          return;
        }

        if (Buffer.isBuffer(data)) {
          uploadStream.end(data);
          return;
        }

        data.once('error', (error) => {
          reject(error);
        });

        data.pipe(uploadStream);
      });
    }).catch((error) => {
      this.throwUploadFailed(key, this.getErrorMessage(error, 'Unknown upload error'));
    });
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const url = this.buildDeliveryUrl(key, 'image');

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          this.throwNotFound(key);
        }

        this.throwUploadFailed(key, `Failed to fetch file: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'STORAGE_FILE_NOT_FOUND') {
        throw error;
      }
      this.throwUploadFailed(key, this.getErrorMessage(error, 'Unknown error'));
    }
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    try {
      const result = (await this.withConfiguredCloudinary(() =>
        cloudinary.uploader.destroy(key, {
          resource_type: 'image',
        })
      )) as { result?: string };

      if (result.result !== 'ok' && result.result !== 'not found') {
        this.throwDeleteFailed(key, `Delete failed: ${result.result}`);
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'STORAGE_DELETE_FAILED') {
        throw error;
      }
      this.throwDeleteFailed(key, error instanceof Error ? error.message : 'Unknown error');
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

    const url = cloudinary.url(key, {
      cloud_name: this.cloudName,
      api_secret: this.apiSecret,
      secure: this.secure,
      sign_url: true,
      expiration: Math.floor(Date.now() / 1000) + options.expiresIn,
    });

    return url;
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    this.validateKey(key);

    try {
      const resource = (await this.withConfiguredCloudinary(() =>
        cloudinary.api.resource(key, {
          resource_type: 'image',
        })
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

      this.throwUploadFailed(key, this.getErrorMessage(error, 'Unknown metadata error'));
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

  async getUploadIntent(key: string): Promise<UploadIntent> {
    this.validateKey(key);

    const uploadUrl = new URL(`/v1_1/${this.cloudName}/image/upload`, this.uploadBaseUrl).toString();
    const publicUrl = this.getPublicUrl(key);
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return {
      uploadUrl,
      publicUrl,
      expiresAt,
    };
  }

  private buildDeliveryUrl(key: string, resourceType: string): string {
    const protocol = this.secure ? 'https' : 'http';
    return `${protocol}://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${key}`;
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
    const release = CloudinaryProvider.operationInFlight
      ? await this.waitForCloudinaryLock()
      : this.acquireCloudinaryLock();
    const previousConfig = { ...(cloudinary.config() ?? {}) };

    cloudinary.config(this.getCloudinaryConfig());

    try {
      return await operation();
    } finally {
      cloudinary.config(previousConfig);
      release();
    }
  }

  private acquireCloudinaryLock(): () => void {
    CloudinaryProvider.operationInFlight = true;
    return () => this.releaseCloudinaryLock();
  }

  private async waitForCloudinaryLock(): Promise<() => void> {
    await new Promise<void>((resolve) => {
      CloudinaryProvider.operationWaiters.push(resolve);
    });

    return () => this.releaseCloudinaryLock();
  }

  private releaseCloudinaryLock(): void {
    const nextWaiter = CloudinaryProvider.operationWaiters.shift();

    if (nextWaiter) {
      nextWaiter();
      return;
    }

    CloudinaryProvider.operationInFlight = false;
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

    return params.length > 0 ? params.join(',') : undefined;
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

    if (options.format !== undefined && options.format !== 'auto') {
      transformOptions.format = options.format;
    }

    if (options.dpr !== undefined) {
      transformOptions.dpr = options.dpr;
    }

    return transformOptions;
  }

  private mapFitMode(fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'): CloudinaryTransformOptions['crop'] {
    switch (fit) {
      case 'cover':
        return 'fill';
      case 'contain':
        return 'fit';
      case 'fill':
        return 'pad';
      case 'inside':
        return 'limit';
      case 'outside':
        return 'crop';
      default:
        return undefined;
    }
  }

  private inferResourceType(contentType?: string): string {
    if (!contentType) {
      return 'auto';
    }

    if (contentType.startsWith('image/')) {
      return 'image';
    }

    if (contentType.startsWith('video/')) {
      return 'video';
    }

    return 'raw';
  }

  private formatContext(metadata: Record<string, string>): string {
    return Object.entries(metadata)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('|');
  }

  private parseContext(context: unknown): Record<string, string> {
    if (typeof context === 'string') {
      return context.split('|').reduce<Record<string, string>>((acc, pair) => {
        const separatorIndex = pair.indexOf('=');

        if (separatorIndex === -1) {
          return acc;
        }

        const rawKey = pair.slice(0, separatorIndex);
        const rawValue = pair.slice(separatorIndex + 1);

        acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
        return acc;
      }, {});
    }

    if (context && typeof context === 'object' && 'custom' in context) {
      const custom = Reflect.get(context, 'custom');
      if (custom && typeof custom === 'object') {
        return Object.entries(custom).reduce<Record<string, string>>((acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[decodeURIComponent(key)] = decodeURIComponent(value);
          }

          return acc;
        }, {});
      }
    }

    if (context && typeof context === 'object') {
      return Object.entries(context).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[decodeURIComponent(key)] = decodeURIComponent(value);
        }

        return acc;
      }, {});
    }

    return {};
  }

  private isNotFoundError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && 'http_code' in error) {
      const httpCode = Reflect.get(error, 'http_code');
      if (httpCode === 404) {
        return true;
      }
    }

    const message = this.getErrorMessage(error, '').toLowerCase();
    return message.includes('not found');
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = Reflect.get(error, 'message');
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }

    return fallback;
  }
}
