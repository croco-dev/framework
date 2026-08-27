import { BaseStorageProvider } from "./BaseStorageProvider";
import { FileNotFoundProblem } from "./problems/FileNotFoundProblem";
import { UploadFailedProblem } from "./problems/UploadFailedProblem";
import { validateSignedUrlExpiry } from "./signedUrlExpiry";
import { readStorageBody, storageStreamFromBytes } from "./storageBody";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageStream,
  StorageOperationOptions,
} from "./types";

type StoredObject = {
  data: Uint8Array;
  metadata?: ObjectMetadata;
};

/**
 * 인메모리 스토리지 제공자 구현체 (테스트용)
 *
 * Map을 사용하여 파일을 메모리에 저장합니다. 실제 운영 환경에서는 사용하지 말고
 * 테스트나 개발 환경에서만 사용하세요.
 */
export class InMemoryStorageProvider extends BaseStorageProvider {
  private storage = new Map<string, StoredObject>();
  private baseUrl: string;

  constructor(baseUrl: string = "https://example.com") {
    super();
    this.baseUrl = baseUrl;
  }

  async put(key: string, data: StorageBody, options?: PutOptions): Promise<void> {
    this.assertOperationNotAborted(options, "put", key);
    this.validateKey(key);

    try {
      const body =
        data instanceof Uint8Array ? data : this.bindOperationSignal(data, options, "put", key);
      const bytes = await readStorageBody(body);

      this.assertOperationNotAborted(options, "put", key);

      const metadata: ObjectMetadata = {
        size: bytes.byteLength,
        contentType: options?.contentType,
        lastModified: new Date(),
        metadata: options?.metadata,
      };

      this.storage.set(key, { data: bytes, metadata });
    } catch (error) {
      this.rethrowOperationAbort(error, options, "put", key);
      throw new UploadFailedProblem(
        key,
        error instanceof Error ? error.message : "Unknown error",
        error instanceof Error ? error : undefined,
      );
    }
  }

  async get(key: string, options?: StorageOperationOptions): Promise<Uint8Array> {
    this.assertOperationNotAborted(options, "get", key);
    this.validateKey(key);

    const object = this.storage.get(key);

    if (!object) {
      throw new FileNotFoundProblem(key);
    }

    return object.data;
  }

  async getStream(key: string, options?: StorageOperationOptions): Promise<StorageStream> {
    this.assertOperationNotAborted(options, "getStream", key);
    this.validateKey(key);

    const object = this.storage.get(key);

    if (!object) {
      throw new FileNotFoundProblem(key);
    }

    return this.bindOperationSignal(storageStreamFromBytes(object.data), options, "getStream", key);
  }

  async delete(key: string, options?: StorageOperationOptions): Promise<void> {
    this.assertOperationNotAborted(options, "delete", key);
    this.validateKey(key);

    if (!this.storage.has(key)) {
      throw new FileNotFoundProblem(key);
    }

    this.storage.delete(key);
  }

  async exists(key: string, options?: StorageOperationOptions): Promise<boolean> {
    this.assertOperationNotAborted(options, "exists", key);
    this.validateKey(key);

    return this.storage.has(key);
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);

    return `${this.baseUrl}/${key}`;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    this.assertOperationNotAborted(options, "getSignedUrl", key);
    this.validateKey(key);
    const expiresIn = validateSignedUrlExpiry(options.expiresIn);

    if (!this.storage.has(key)) {
      throw new FileNotFoundProblem(key);
    }

    const expiresAt = Date.now() + expiresIn * 1000;
    return `${this.baseUrl}/${key}?expires=${expiresAt}`;
  }

  async getMetadata(key: string, options?: StorageOperationOptions): Promise<ObjectMetadata> {
    this.assertOperationNotAborted(options, "getMetadata", key);
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

  clear(): void {
    this.storage.clear();
  }
}
