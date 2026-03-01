import { Readable } from 'node:stream';
import { DeleteFailedProblem } from './problems/DeleteFailedProblem';
import { FileNotFoundProblem } from './problems/FileNotFoundProblem';
import { InvalidKeyProblem } from './problems/InvalidKeyProblem';
import { UploadFailedProblem } from './problems/UploadFailedProblem';
import type { ObjectMetadata, PutOptions, SignedUrlOptions, StorageProvider } from './types';

export abstract class BaseStorageProvider implements StorageProvider {
  protected validateKey(key: string): void {
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

  async getStream(key: string): Promise<Readable> {
    const buffer = await this.get(key);
    return Readable.from(buffer);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.get(key);
      return true;
    } catch (error) {
      if (error instanceof FileNotFoundProblem) {
        return false;
      }
      throw error;
    }
  }

  protected throwNotFound(key: string, cause?: unknown): never {
    throw new FileNotFoundProblem(key, cause instanceof Error ? cause : undefined);
  }

  protected throwUploadFailed(key: string, cause?: unknown): never {
    const reason = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined;
    throw new UploadFailedProblem(key, reason, cause instanceof Error ? cause : undefined);
  }

  protected throwDeleteFailed(key: string, cause?: unknown): never {
    throw new DeleteFailedProblem(key, cause);
  }

  abstract put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void>;
  abstract get(key: string): Promise<Buffer>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
  abstract getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  abstract getMetadata(key: string): Promise<ObjectMetadata>;
}
