import { DeleteFailedProblem } from "./problems/DeleteFailedProblem";
import { FileNotFoundProblem } from "./problems/FileNotFoundProblem";
import { InvalidKeyProblem } from "./problems/InvalidKeyProblem";
import { UploadFailedProblem } from "./problems/UploadFailedProblem";
import { readStorageStream } from "./storageBody";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageProvider,
  StorageStream,
} from "./types";

export abstract class BaseStorageProvider implements StorageProvider {
  protected validateKey(key: string): void {
    if (!key || typeof key !== "string") {
      throw new InvalidKeyProblem(key, "Key must be a non-empty string");
    }
    if (key.startsWith("/") || key.endsWith("/")) {
      throw new InvalidKeyProblem(key, "Key must not start or end with /");
    }
    if (key.includes("//")) {
      throw new InvalidKeyProblem(key, "Key must not contain //");
    }
  }

  async get(key: string): Promise<Uint8Array> {
    return readStorageStream(await this.getStream(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      const stream = await this.getStream(key);
      await stream.cancel();
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
    const reason =
      cause instanceof Error ? cause.message : typeof cause === "string" ? cause : undefined;
    throw new UploadFailedProblem(key, reason, cause instanceof Error ? cause : undefined);
  }

  protected throwDeleteFailed(key: string, cause?: unknown): never {
    throw new DeleteFailedProblem(key, cause);
  }

  abstract put(key: string, data: StorageBody, options?: PutOptions): Promise<void>;
  abstract getStream(key: string): Promise<StorageStream>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
  abstract getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  abstract getMetadata(key: string): Promise<ObjectMetadata>;
}
