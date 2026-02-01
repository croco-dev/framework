import type { Readable } from 'node:stream';
import { Readable as ReadableImpl } from 'node:stream';
import { FileNotFoundProblem } from './problems/FileNotFoundProblem';
import { InvalidKeyProblem } from './problems/InvalidKeyProblem';
import { UploadFailedProblem } from './problems/UploadFailedProblem';
import type { ObjectMetadata, PutOptions, SignedUrlOptions, StorageProvider } from './types';

type StoredObject = {
  data: Buffer;
  metadata?: ObjectMetadata;
};

/**
 * 인메모리 스토리지 제공자 구현체 (테스트용)
 *
 * Map을 사용하여 파일을 메모리에 저장합니다. 실제 운영 환경에서는 사용하지 말고
 * 테스트나 개발 환경에서만 사용하세요.
 */
export class InMemoryStorageProvider implements StorageProvider {
  private storage = new Map<string, StoredObject>();
  private baseUrl: string;

  constructor(baseUrl: string = 'https://example.com') {
    this.baseUrl = baseUrl;
  }

  async put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void> {
    this.validateKey(key);

    try {
      let buffer: Buffer;

      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      }

      const metadata: ObjectMetadata = {
        size: buffer.length,
        contentType: options?.contentType,
        lastModified: new Date(),
        metadata: options?.metadata,
      };

      this.storage.set(key, { data: buffer, metadata });
    } catch (error) {
      throw new UploadFailedProblem(key, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);

    const object = this.storage.get(key);

    if (!object) {
      throw new FileNotFoundProblem(key);
    }

    return object.data;
  }

  async getStream(key: string): Promise<Readable> {
    this.validateKey(key);

    const object = this.storage.get(key);

    if (!object) {
      throw new FileNotFoundProblem(key);
    }

    return ReadableImpl.from(object.data);
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    if (!this.storage.has(key)) {
      throw new FileNotFoundProblem(key);
    }

    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    this.validateKey(key);

    return this.storage.has(key);
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    return `${this.baseUrl}/${key}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.validateKey(key);

    if (!this.storage.has(key)) {
      throw new FileNotFoundProblem(key);
    }

    const expiresAt = Date.now() + options.expiresIn * 1000;
    return `${this.baseUrl}/${key}?expires=${expiresAt}`;
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    this.validateKey(key);

    const object = this.storage.get(key);

    if (!object) {
      throw new FileNotFoundProblem(key);
    }

    return (
      object.metadata ?? {
        size: object.data.length,
        lastModified: new Date(),
      }
    );
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

  clear(): void {
    this.storage.clear();
  }
}
