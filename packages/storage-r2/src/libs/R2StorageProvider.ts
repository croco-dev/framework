import type { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigService } from '@croco/framework-config';
import { Component } from '@croco/framework-context';
import type { Logger } from '@croco/framework-logger';
import type { ObjectMetadata, PutOptions, SignedUrlOptions } from '@croco/storage-core';
import { BaseStorageProvider } from '@croco/storage-core';
import type { R2Options } from './types';

/**
 * Cloudflare R2 스토리지 제공자
 *
 * AWS S3 SDK를 사용하여 R2와 통신합니다.
 */
@Component()
export class R2StorageProvider extends BaseStorageProvider {
  private readonly client: S3Client;
  private readonly options: R2Options;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger
  ) {
    super();
    this.options = {
      accountId: this.config.get('R2_ACCOUNT_ID') ?? '',
      accessKeyId: this.config.get('R2_ACCESS_KEY_ID') ?? '',
      secretAccessKey: this.config.get('R2_SECRET_ACCESS_KEY') ?? '',
      bucket: this.config.get('R2_BUCKET') ?? '',
      publicUrlBase: this.config.get('R2_PUBLIC_URL_BASE'),
    };

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.options.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      Body: data,
      ContentType: options?.contentType,
      CacheControl: options?.cacheControl,
      Metadata: options?.metadata,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.throwUploadFailed(key, error);
    }
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as Readable;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      return this.handleNotFoundError(key, error);
    }
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new DeleteObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.throwDeleteFailed(key, error);
    }
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    if (this.options.publicUrlBase) {
      const normalizedBase = this.options.publicUrlBase.replace(/\/+$/, '');
      return `${normalizedBase}/${key}`;
    }

    return `https://${this.options.bucket}.${this.options.accountId}.r2.dev/${key}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

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

    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new HeadObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);

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
    if (error && typeof error === 'object' && '$metadata' in error) {
      const metadata = error.$metadata as { httpStatusCode?: number };
      return metadata.httpStatusCode === 404;
    }
    if (error instanceof Error && 'name' in error) {
      return error.name === 'NotFound';
    }
    return false;
  }

  private handleNotFoundError(key: string, error: unknown): never {
    if (this.isNotFoundError(error)) {
      this.throwNotFound(key, error);
    }
    throw error;
  }
}
