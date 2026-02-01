import type { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigService } from '@croco/framework-config';
import { Component } from '@croco/framework-context';
import type { Logger } from '@croco/framework-logger';
import type { ObjectMetadata, PutOptions, SignedUrlOptions, StorageProvider } from '@croco/storage-core';
import type { R2Options } from './types';

/**
 * Cloudflare R2 스토리지 제공자
 *
 * AWS S3 SDK를 사용하여 R2와 통신합니다.
 */
@Component()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly options: R2Options;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger
  ) {
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
      this.throwUploadError(key, error);
    }
  }

  async get(key: string): Promise<Buffer> {
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
      return this.throwNotFoundError(key, error);
    }
  }

  async getStream(key: string): Promise<Readable> {
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

      return response.Body as Readable;
    } catch (error) {
      return this.throwNotFoundError(key, error);
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new DeleteObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.logger.warn(`[R2StorageProvider] Failed to delete key '${key}':`, { error });
    }
  }

  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new HeadObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    if (this.options.publicUrlBase) {
      return `${this.options.publicUrlBase}/${key}`;
    }
    return `https://${this.options.bucket}.${this.options.accountId}.r2.dev/${key}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
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
      return this.throwNotFoundError(key, error);
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

  /**
   * 404 에러를 FileNotFoundProblem으로 변환
   */
  private throwNotFoundError(key: string, error: unknown): never {
    if (this.isNotFoundError(error)) {
      const { FileNotFoundProblem } = require('@croco/storage-core');
      throw new FileNotFoundProblem(key);
    }
    throw error;
  }

  /**
   * 업로드 에러를 UploadFailedProblem으로 변환
   */
  private throwUploadError(key: string, error: unknown): never {
    const { UploadFailedProblem } = require('@croco/storage-core');
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new UploadFailedProblem(key, message);
  }
}
