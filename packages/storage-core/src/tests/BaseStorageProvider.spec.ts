import { describe, expect, it } from "vitest";
import { BaseStorageProvider } from "../libs/BaseStorageProvider";
import { DeleteFailedProblem } from "../libs/problems/DeleteFailedProblem";
import { FileNotFoundProblem } from "../libs/problems/FileNotFoundProblem";
import { UploadFailedProblem } from "../libs/problems/UploadFailedProblem";
import { storageStreamFromBytes } from "../libs/storageBody";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageBody,
  StorageStream,
} from "../libs/types";

class TestStorageProvider extends BaseStorageProvider {
  probeMode = false;
  streamCancelled = false;

  async put(_key: string, _data: StorageBody, _options?: PutOptions): Promise<void> {}

  async getStream(_key: string): Promise<StorageStream> {
    if (this.probeMode) {
      return new ReadableStream({
        cancel: () => {
          this.streamCancelled = true;
        },
      });
    }

    return storageStreamFromBytes(new Uint8Array([1, 2, 3]));
  }

  async delete(_key: string): Promise<void> {}

  getPublicUrl(key: string): string {
    return key;
  }

  async getSignedUrl(key: string, _options: SignedUrlOptions): Promise<string> {
    return key;
  }

  async getMetadata(_key: string): Promise<ObjectMetadata> {
    return {
      size: 0,
      lastModified: new Date(),
    };
  }

  callThrowNotFound(key: string, cause?: unknown): never {
    return this.throwNotFound(key, cause);
  }

  callThrowUploadFailed(key: string, cause?: unknown): never {
    return this.throwUploadFailed(key, cause);
  }

  callThrowDeleteFailed(key: string, cause?: unknown): never {
    return this.throwDeleteFailed(key, cause);
  }
}

describe("BaseStorageProvider", () => {
  const provider = new TestStorageProvider();

  it("buffers the portable stream only for the explicit buffered get operation", async () => {
    await expect(provider.get("test/file.bin")).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it("checks existence without buffering the object body", async () => {
    provider.probeMode = true;
    provider.streamCancelled = false;

    try {
      await expect(provider.exists("test/file.bin")).resolves.toBe(true);
      expect(provider.streamCancelled).toBe(true);
    } finally {
      provider.probeMode = false;
    }
  });

  it("throwNotFound가 cause를 FileNotFoundProblem에 전달함", () => {
    const cause = new Error("missing");

    try {
      provider.callThrowNotFound("missing/file.txt", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(FileNotFoundProblem);
      expect((error as FileNotFoundProblem).cause).toBe(cause);
    }
  });

  it("throwUploadFailed가 cause를 UploadFailedProblem에 전달함", () => {
    const cause = new Error("upload failed");

    try {
      provider.callThrowUploadFailed("upload/file.txt", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(UploadFailedProblem);
      expect((error as UploadFailedProblem).cause).toBe(cause);
    }
  });

  it("throwDeleteFailed가 cause를 DeleteFailedProblem에 전달함", () => {
    const cause = new Error("delete failed");

    try {
      provider.callThrowDeleteFailed("delete/file.txt", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(DeleteFailedProblem);
      expect((error as DeleteFailedProblem).cause).toBe(cause);
    }
  });
});
