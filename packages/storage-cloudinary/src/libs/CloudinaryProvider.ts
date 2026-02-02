import type { Readable } from 'node:stream';
import { Readable as ReadableImpl } from 'node:stream';
import { Component } from '@croco/framework-context';
import type {
  ImageProvider,
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageProvider,
  TransformOptions,
  UploadIntent,
} from '@croco/storage-core';
import { FileNotFoundProblem, InvalidKeyProblem, UploadFailedProblem } from '@croco/storage-core';
import { v2 as cloudinary } from 'cloudinary';
import type { CloudinaryConfig, CloudinaryTransformOptions } from './types';

@Component()
export class CloudinaryProvider implements StorageProvider, ImageProvider {
  private readonly cloudName: string;
  private readonly secure: boolean;

  constructor(config: CloudinaryConfig) {
    this.cloudName = config.cloudName;
    this.secure = config.secure ?? true;

    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: this.secure,
    });
  }

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);

    try {
      const uploadOptions: Record<string, unknown> = {
        public_id: key,
        resource_type: this.inferResourceType(options?.contentType),
      };

      if (options?.metadata) {
        uploadOptions.context = this.formatContext(options.metadata);
      }

      return new Promise<void>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error: Error | undefined, _result: unknown) => {
            if (error) {
              reject(new UploadFailedProblem(key, error.message));
            } else {
              resolve();
            }
          }
        );

        if (Buffer.isBuffer(data)) {
          uploadStream.end(data);
        } else {
          data.pipe(uploadStream);
        }
      });
    } catch (error) {
      void error;
      throw new UploadFailedProblem(key, 'Unknown upload error');
    }
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const url = this.buildDeliveryUrl(key, 'image');

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new FileNotFoundProblem(key);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof FileNotFoundProblem) {
        throw error;
      }
      throw new UploadFailedProblem(key, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getStream(key: string): Promise<Readable> {
    const buffer = await this.get(key);
    return ReadableImpl.from(buffer);
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    try {
      const result = await cloudinary.uploader.destroy(key, {
        resource_type: 'image',
      });

      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new UploadFailedProblem(key, `Delete failed: ${result.result}`);
      }
    } catch (error) {
      if (error instanceof UploadFailedProblem) {
        throw error;
      }
      throw new UploadFailedProblem(key, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async exists(key: string): Promise<boolean> {
    this.validateKey(key);

    try {
      const resource = await cloudinary.api.resource(key, {
        resource_type: 'image',
      });
      return !!resource;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);
    return cloudinary.url(key, {
      secure: this.secure,
    });
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);

    const url = cloudinary.url(key, {
      secure: this.secure,
      sign_url: true,
      expiration: Math.floor(Date.now() / 1000) + options.expiresIn,
    });

    return url;
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    this.validateKey(key);

    try {
      const resource = await cloudinary.api.resource(key, {
        resource_type: 'image',
      });

      return {
        size: resource.bytes ?? 0,
        contentType: resource.format,
        lastModified: new Date(resource.created_at),
        etag: resource.etag,
        metadata: resource.context ? this.parseContext(resource.context) : undefined,
      };
    } catch {
      throw new FileNotFoundProblem(key);
    }
  }

  getTransformUrl(key: string, options: TransformOptions): string {
    this.validateKey(key);

    const transformOptions = this.toCloudinaryTransformOptions(options);
    const params = this.buildTransformParams(transformOptions);

    return cloudinary.url(key, {
      secure: this.secure,
      transformation: params,
    });
  }

  async getUploadIntent(key: string): Promise<UploadIntent> {
    this.validateKey(key);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
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
      .map(([key, value]) => `${key}=${value}`)
      .join('|');
  }

  private parseContext(context: Record<string, any>): Record<string, string> {
    if (context && typeof context === 'object' && 'custom' in context) {
      return context.custom as Record<string, string>;
    }
    return context as Record<string, string>;
  }

  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new InvalidKeyProblem(key, 'Key must be a non-empty string');
    }

    if (key.startsWith('/') || key.endsWith('/')) {
      throw new InvalidKeyProblem(key, 'Key must not start or end with /');
    }

    if (key.includes('//')) {
      throw new InvalidKeyProblem(key, 'Key must not contain //');
    }
  }
}
