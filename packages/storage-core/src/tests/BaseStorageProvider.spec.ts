import type { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { BaseStorageProvider } from "../libs/BaseStorageProvider";
import { DeleteFailedProblem } from "../libs/problems/DeleteFailedProblem";
import { FileNotFoundProblem } from "../libs/problems/FileNotFoundProblem";
import { UploadFailedProblem } from "../libs/problems/UploadFailedProblem";
import type { ObjectMetadata, PutOptions, SignedUrlOptions } from "../libs/types";

class TestStorageProvider extends BaseStorageProvider {
  async put(_key: string, _data: Buffer | Readable, _options?: PutOptions): Promise<void> {}

  async get(_key: string): Promise<Buffer> {
    return Buffer.alloc(0);
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
