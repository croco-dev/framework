import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { Container } from "@croco/framework-context";
import type {
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  TransformOptions,
  UploadIntent,
} from "@croco/storage-core";
import {
  FileNotFoundProblem,
  InvalidKeyProblem,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  storageStreamFromBytes,
} from "@croco/storage-core";
import { createStorageProviderConformanceSuite } from "@croco/testing";
import { v2 as cloudinary } from "cloudinary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudinaryProvider } from "../libs/CloudinaryProvider";

type UploadStream = typeof cloudinary.uploader.upload_stream;
type StoredCloudinaryObject = {
  readonly context?: string;
  readonly createdAt: string;
  readonly data: Buffer;
  readonly etag: string;
};

// Cloudinary SDK 모킹
vi.mock("cloudinary", async (importOriginal) => {
  const original = await importOriginal<{ v2: typeof cloudinary }>();

  return {
    v2: {
      ...original.v2,
      config: vi.fn(),
      uploader: {
        upload_stream: vi.fn(),
        destroy: vi.fn(),
      },
      api: {
        resource: vi.fn(),
      },
      url: vi.fn(() => "https://res.cloudinary.com/test-cloud/image/upload/test-key"),
    },
  };
});

// fetch 모킹
global.fetch = vi.fn();

describe("CloudinaryProvider", () => {
  let provider!: CloudinaryProvider;

  const mockConfig = {
    cloudName: "test-cloud",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
    secure: true,
  };

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();

    provider = new CloudinaryProvider(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("storage provider conformance", () => {
    it.each(
      createStorageProviderConformanceSuite({
        createProvider: () => {
          useInMemoryCloudinaryBackend();
          return provider;
        },
        keyPrefix: "cloudinary-conformance",
        metadata: {
          contentType: "unsupported",
          customMetadata: "required",
        },
        putContentType: "image/png",
        providerName: "storage-cloudinary",
        publicUrl: "https://res.cloudinary.com/test-cloud/image/upload/",
        signedUrl: /s=mock-signature/,
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  it("should not mutate global cloudinary config during construction", () => {
    expect(cloudinary.config).not.toHaveBeenCalled();
  });

  it("should run Cloudinary operations from different instances concurrently", async () => {
    const firstProvider = new CloudinaryProvider(mockConfig);
    const secondProvider = new CloudinaryProvider({
      cloudName: "other-cloud",
      apiKey: "other-api-key",
      apiSecret: "other-api-secret",
      secure: true,
    });
    let activeUploads = 0;
    let maxActiveUploads = 0;
    const resolvers: Array<() => void> = [];
    const mockUploadStream = vi.fn(
      (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
        activeUploads += 1;
        maxActiveUploads = Math.max(maxActiveUploads, activeUploads);

        return {
          end: vi.fn(() => {
            resolvers.push(() => {
              activeUploads -= 1;
              callback(undefined, { public_id: "test-key" });
            });
          }),
        };
      },
    );

    vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
      mockUploadStream as unknown as UploadStream,
    );

    const firstUpload = firstProvider.put("first-key", Buffer.from("first"));
    const secondUpload = secondProvider.put("second-key", Buffer.from("second"));

    await vi.waitFor(() => expect(resolvers).toHaveLength(2));

    expect(maxActiveUploads).toBe(2);

    for (const resolve of resolvers) {
      resolve();
    }
    await expect(Promise.all([firstUpload, secondUpload])).resolves.toEqual([undefined, undefined]);
  });

  describe("put()", () => {
    it("should upload buffer data successfully", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: "test-key" });
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");
      await expect(provider.put("test-key", buffer)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: "test-key",
          resource_type: "image",
        },
        expect.any(Function),
      );
    });

    it("should upload Web ReadableStream data successfully", async () => {
      const { PassThrough } = await import("node:stream");
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          const destination = new PassThrough();
          queueMicrotask(() => {
            callback(undefined, { public_id: "test-key" });
          });
          return destination;
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const stream = storageStreamFromBytes(Buffer.from("test data"));

      await expect(provider.put("test-key", stream)).resolves.not.toThrow();
    });

    it("should upload with content type option", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: "test-key" });
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");
      const options: PutOptions = { contentType: "image/jpeg" };

      await expect(provider.put("test-key", buffer, options)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: "test-key",
          resource_type: "image",
        },
        expect.any(Function),
      );
    });

    it("should upload with metadata", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: "test-key" });
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");
      const options: PutOptions = {
        metadata: { alt: "test image", author: "test" },
      };

      await expect(provider.put("test-key", buffer, options)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: "test-key",
          resource_type: "image",
          context: "alt=test%20image|author=test",
        },
        expect.any(Function),
      );
    });

    it("should escape metadata values containing separators", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: "test-key" });
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");
      const options: PutOptions = {
        metadata: {
          alt: "value=with|separators",
          "special|key": "hello=world",
        },
      };

      await expect(provider.put("test-key", buffer, options)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: "test-key",
          resource_type: "image",
          context: "alt=value%3Dwith%7Cseparators|special%7Ckey=hello%3Dworld",
        },
        expect.any(Function),
      );
    });

    it("should throw terminal provider Problem on upload error", async () => {
      const mockError = new Error("Upload failed");
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(mockError, undefined);
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");

      await expect(provider.put("test-key", buffer)).rejects.toMatchObject({
        code: "storage-cloudinary/terminal-upstream",
      });
    });

    it("should retry transient upload errors before succeeding", async () => {
      let attempts = 0;
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          attempts += 1;

          if (attempts < 3) {
            callback(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }), undefined);
          } else {
            callback(undefined, { public_id: "test-key" });
          }

          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      await expect(provider.put("test-key", Buffer.from("test data"))).resolves.not.toThrow();
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    });

    it("should retry transient object-like upload errors for buffers before succeeding", async () => {
      let attempts = 0;
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          attempts += 1;

          if (attempts < 3) {
            callback(
              { http_code: 503, message: "Service unavailable" } as unknown as Error,
              undefined,
            );
          } else {
            callback(undefined, { public_id: "test-key" });
          }

          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      await expect(provider.put("test-key", Buffer.from("test data"))).resolves.not.toThrow();
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    });

    it("should throw terminal provider Problem when upload stream creation throws", async () => {
      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(() => {
        throw new Error("Cloudinary SDK error");
      });

      await expect(provider.put("test-key", Buffer.from("test data"))).rejects.toMatchObject({
        code: "storage-cloudinary/terminal-upstream",
      });
    });

    it("should throw terminal provider Problem when source stream emits error", async () => {
      const { PassThrough } = await import("node:stream");
      const destination = new PassThrough();

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        () => destination as unknown as ReturnType<UploadStream>,
      );

      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("Stream broken"));
        },
      });
      const putPromise = provider.put("test-key", source);

      await expect(putPromise).rejects.toMatchObject({
        code: "storage-cloudinary/terminal-upstream",
      });
    });

    it("should not retry Web ReadableStream uploads on transient callback errors", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(
            { http_code: 503, message: "Service unavailable" } as unknown as Error,
            undefined,
          );
          return {
            end: vi.fn(),
            on: vi.fn(),
            once: vi.fn(),
            emit: vi.fn(),
            write: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      await expect(
        provider.put("test-key", storageStreamFromBytes(Buffer.from("test data"))),
      ).rejects.toMatchObject({
        code: "storage-cloudinary/retryable-upstream",
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
    });

    it("should throw InvalidKeyProblem for empty key", async () => {
      const buffer = Buffer.from("test data");

      await expect(provider.put("", buffer)).rejects.toThrow(InvalidKeyProblem);
    });

    it("should throw InvalidKeyProblem for key starting with /", async () => {
      const buffer = Buffer.from("test data");

      await expect(provider.put("/invalid-key", buffer)).rejects.toThrow(InvalidKeyProblem);
    });

    it("should throw InvalidKeyProblem for key ending with /", async () => {
      const buffer = Buffer.from("test data");

      await expect(provider.put("invalid-key/", buffer)).rejects.toThrow(InvalidKeyProblem);
    });

    it("should throw InvalidKeyProblem for key containing //", async () => {
      const buffer = Buffer.from("test data");

      await expect(provider.put("invalid//key", buffer)).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("get()", () => {
    it("should fetch resource successfully", async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response(new Uint8Array(10)));

      const result = await provider.get("test-key");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://res.cloudinary.com/test-cloud/image/upload/test-key",
      );
    });

    it("should throw FileNotFoundProblem on 404", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(provider.get("test-key")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should throw retryable provider Problem on retryable HTTP error", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(provider.get("test-key")).rejects.toMatchObject({
        code: "storage-cloudinary/retryable-upstream",
      });
    });

    it("should throw retryable provider Problem on fetch error", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      await expect(provider.get("test-key")).rejects.toMatchObject({
        code: "storage-cloudinary/retryable-upstream",
      });
    });

    it("should normalize a response body read failure", async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.error(
                Object.assign(new Error("connection reset"), { code: "ECONNRESET" }),
              );
            },
          }),
        ),
      );

      await expect(provider.get("test-key")).rejects.toMatchObject({
        code: "storage-cloudinary/retryable-upstream",
        extensions: {
          key: "test-key",
          operation: "get",
        },
      });
    });

    it("should retry transient fetch failures before succeeding", async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response)
        .mockResolvedValueOnce(new Response(new Uint8Array(4)));

      const result = await provider.get("test-key");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry not found fetch failures", async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 404 } as unknown as Response);

      await expect(provider.get("test-key")).rejects.toThrow(FileNotFoundProblem);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should throw InvalidKeyProblem for invalid key", async () => {
      await expect(provider.get("")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("getStream()", () => {
    it("should return readable stream", async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response(new Uint8Array(10)));

      const stream = await provider.getStream("test-key");

      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe("delete()", () => {
    it("should delete resource successfully", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: "ok" });

      await expect(provider.delete("test-key")).resolves.not.toThrow();

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("test-key", {
        resource_type: "image",
      });
    });

    it("should handle not found result gracefully", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: "not found" });

      await expect(provider.delete("test-key")).resolves.not.toThrow();
    });

    it("should throw terminal provider Problem on delete failure", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: "error" });

      await expect(provider.delete("test-key")).rejects.toMatchObject({
        code: "storage-cloudinary/terminal-upstream",
      });
    });

    it("should retry transient delete failures before succeeding", async () => {
      vi.mocked(cloudinary.uploader.destroy)
        .mockRejectedValueOnce({ http_code: 503, message: "Service unavailable" })
        .mockResolvedValueOnce({ result: "ok" });

      await expect(provider.delete("test-key")).resolves.not.toThrow();
      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    });

    it("should throw InvalidKeyProblem for invalid key", async () => {
      await expect(provider.delete("")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("exists()", () => {
    it("should return true for existing resource", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));

      const result = await provider.exists("test-key");

      expect(result).toBe(true);
    });

    it("should return false for non-existing resource", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

      const result = await provider.exists("test-key");

      expect(result).toBe(false);
    });

    it("should throw InvalidKeyProblem for invalid key", async () => {
      await expect(provider.exists("")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("getPublicUrl()", () => {
    it("should return public URL", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/test-key",
      );

      const url = provider.getPublicUrl("test-key");

      expect(url).toBe("https://res.cloudinary.com/test-cloud/image/upload/test-key");
      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
      });
    });

    it("should return HTTP URL when secure is false", () => {
      const httpProvider = new CloudinaryProvider({ ...mockConfig, secure: false });
      vi.mocked(cloudinary.url).mockReturnValue(
        "http://res.cloudinary.com/test-cloud/image/upload/test-key",
      );

      httpProvider.getPublicUrl("test-key");

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: false,
      });
    });

    it("should throw InvalidKeyProblem for invalid key", () => {
      expect(() => provider.getPublicUrl("")).toThrow(InvalidKeyProblem);
    });
  });

  describe("getSignedUrl()", () => {
    it("should return signed URL with expiration", async () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/test-key?s=sig",
      );

      const options: SignedUrlOptions = { expiresIn: MAX_SIGNED_URL_EXPIRY_SECONDS };
      const url = await provider.getSignedUrl("test-key", options);

      expect(url).toBe("https://res.cloudinary.com/test-cloud/image/upload/test-key?s=sig");

      const now = Date.now() / 1000;
      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        api_secret: "test-api-secret",
        secure: true,
        sign_url: true,
        expiration: Math.floor(now) + MAX_SIGNED_URL_EXPIRY_SECONDS,
      });
    });

    it("should throw InvalidKeyProblem for invalid key", async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };

      await expect(provider.getSignedUrl("", options)).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("getMetadata()", () => {
    it("should return resource metadata", async () => {
      const mockResource = {
        bytes: 1024,
        format: "jpg",
        created_at: "2024-01-01T00:00:00Z",
        etag: "abc123",
        context: { custom: { alt: "test", author: "test" } },
      };

      vi.mocked(cloudinary.api.resource).mockResolvedValue(mockResource);

      const metadata = await provider.getMetadata("test-key");

      const expectedMetadata: ObjectMetadata = {
        size: 1024,
        contentType: "jpg",
        lastModified: new Date("2024-01-01T00:00:00Z"),
        etag: "abc123",
        metadata: { alt: "test", author: "test" },
      };

      expect(metadata).toEqual(expectedMetadata);
    });

    it("should decode escaped metadata values", async () => {
      const mockResource = {
        bytes: 1024,
        format: "jpg",
        created_at: "2024-01-01T00:00:00Z",
        context: {
          custom: {
            alt: "value%3Dwith%7Cseparators",
            "special%7Ckey": "hello%3Dworld",
          },
        },
      };

      vi.mocked(cloudinary.api.resource).mockResolvedValue(mockResource);

      const metadata = await provider.getMetadata("test-key");

      expect(metadata.metadata).toEqual({
        alt: "value=with|separators",
        "special|key": "hello=world",
      });
    });

    it("should handle missing optional metadata fields", async () => {
      const mockResource = {
        bytes: 0,
        format: "png",
        created_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(cloudinary.api.resource).mockResolvedValue(mockResource);

      const metadata = await provider.getMetadata("test-key");

      expect(metadata.size).toBe(0);
      expect(metadata.etag).toBeUndefined();
      expect(metadata.metadata).toBeUndefined();
    });

    it("should throw FileNotFoundProblem on resource not found", async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue(new Error("Not found"));

      await expect(provider.getMetadata("test-key")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should throw FileNotFoundProblem when Cloudinary returns 404 code", async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue({
        http_code: 404,
        message: "Resource not found",
      });

      await expect(provider.getMetadata("test-key")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should throw validation provider Problem for non-404 metadata validation errors", async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue({
        http_code: 403,
        message: "Forbidden",
      });

      await expect(provider.getMetadata("test-key")).rejects.toMatchObject({
        code: "storage-cloudinary/validation-failed",
      });
    });

    it("should retry transient metadata failures before succeeding", async () => {
      const mockResource = {
        bytes: 1024,
        format: "jpg",
        created_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(cloudinary.api.resource)
        .mockRejectedValueOnce({ http_code: 429, message: "Too many requests" })
        .mockResolvedValueOnce(mockResource);

      const metadata = await provider.getMetadata("test-key");

      expect(metadata.size).toBe(1024);
      expect(cloudinary.api.resource).toHaveBeenCalledTimes(2);
    });

    it("should throw InvalidKeyProblem for invalid key", async () => {
      await expect(provider.getMetadata("")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("getTransformUrl()", () => {
    it("should generate transform URL with width and height", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/w_200,h_200/test-key",
      );

      const options: TransformOptions = { width: 200, height: 200 };
      const url = provider.getTransformUrl("test-key", options);

      expect(url).toBe("https://res.cloudinary.com/test-cloud/image/upload/w_200,h_200/test-key");
      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "w_200,h_200",
      });
    });

    it("should generate transform URL with fit mode", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/c_fill/test-key",
      );

      const options: TransformOptions = { fit: "cover" };
      provider.getTransformUrl("test-key", options);

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "c_fill",
      });
    });

    it("should generate transform URL with quality", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/q_80/test-key",
      );

      const options: TransformOptions = { quality: 80 };
      provider.getTransformUrl("test-key", options);

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "q_80",
      });
    });

    it("should generate transform URL with format", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/f_webp/test-key",
      );

      const options: TransformOptions = { format: "webp" };
      provider.getTransformUrl("test-key", options);

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "f_webp",
      });
    });

    it("should ignore auto format", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/test-key",
      );

      const options: TransformOptions = { format: "auto" };
      provider.getTransformUrl("test-key", options);

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: undefined,
      });
    });

    it("should generate transform URL with DPR", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/dpr_2.0/test-key",
      );

      const options: TransformOptions = { dpr: 2 };
      provider.getTransformUrl("test-key", options);

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "dpr_2",
      });
    });

    it("should generate transform URL with combined options", () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/w_200,h_200,c_fill,q_80/test-key",
      );

      const options: TransformOptions = {
        width: 200,
        height: 200,
        fit: "cover",
        quality: 80,
      };
      provider.getTransformUrl("test-key", options);

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "w_200,h_200,c_fill,q_80",
      });
    });

    it("should throw InvalidKeyProblem for invalid key", () => {
      const options: TransformOptions = { width: 200 };

      expect(() => provider.getTransformUrl("", options)).toThrow(InvalidKeyProblem);
    });
  });

  describe("getUploadIntent()", () => {
    it("should return a deterministic signed multipart upload intent without exposing the API secret", async () => {
      const now = 1_800_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/test-key",
      );

      const intent = await provider.getUploadIntent("test-key");
      const repeatedIntent = await provider.getUploadIntent("test-key");
      const timestamp = String(now / 1000);
      const signature = createHash("sha1")
        .update(`public_id=test-key&timestamp=${timestamp}${mockConfig.apiSecret}`)
        .digest("hex");

      const expectedIntent: UploadIntent = {
        uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
        publicUrl: "https://res.cloudinary.com/test-cloud/image/upload/test-key",
        fields: {
          api_key: mockConfig.apiKey,
          public_id: "test-key",
          signature,
          timestamp,
        },
        expiresAt: new Date(now + 3600 * 1000),
      };

      expect(intent).toEqual(expectedIntent);
      expect(repeatedIntent).toEqual(expectedIntent);
      expect(Object.values(intent.fields ?? {})).not.toContain(mockConfig.apiSecret);
    });

    it("should apply ttlInSeconds option to upload intent", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/test-cloud/image/upload/test-key",
      );

      const intent = await provider.getUploadIntent("test-key", { ttlInSeconds: 120 });

      expect(intent.expiresAt.getTime()).toBe(now + 120 * 1000);
    });

    it("should reject TTL values outside Cloudinary's one-hour signature validity", async () => {
      for (const ttlInSeconds of [0, -1, 3601]) {
        await expect(provider.getUploadIntent("test-key", { ttlInSeconds })).rejects.toMatchObject({
          code: "storage-cloudinary/invalid-upload-intent-ttl",
        });
      }

      expect(cloudinary.url).not.toHaveBeenCalled();
    });

    it("should reject an invalid configured TTL instead of silently issuing a longer intent", async () => {
      const invalidTtlProvider = new CloudinaryProvider({ ...mockConfig, ttl: 3601 });

      await expect(invalidTtlProvider.getUploadIntent("test-key")).rejects.toMatchObject({
        code: "storage-cloudinary/invalid-upload-intent-ttl",
      });
      expect(cloudinary.url).not.toHaveBeenCalled();
    });

    it("should throw Problem when ttlInSeconds is not a finite integer", async () => {
      for (const ttlInSeconds of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
        await expect(provider.getUploadIntent("test-key", { ttlInSeconds })).rejects.toMatchObject({
          code: "storage-cloudinary/invalid-upload-intent-ttl",
        });
      }
    });

    it("should throw InvalidKeyProblem for invalid key", async () => {
      await expect(provider.getUploadIntent("")).rejects.toThrow(InvalidKeyProblem);
    });

    it("should reject image keys whose last segment includes a file extension", async () => {
      await expect(provider.getUploadIntent("uploads/avatar.png")).rejects.toThrow(
        InvalidKeyProblem,
      );
      expect(cloudinary.url).not.toHaveBeenCalled();
    });

    it("should allow custom upload base URL", async () => {
      const customProvider = new CloudinaryProvider({
        ...mockConfig,
        uploadBaseUrl: "https://uploads.example.com/cloudinary",
      });

      const intent = await customProvider.getUploadIntent("test-key");

      expect(intent.uploadUrl).toBe("https://uploads.example.com/v1_1/test-cloud/image/upload");
    });
  });

  describe("fit mode mapping", () => {
    it("should map cover to fill", () => {
      vi.mocked(cloudinary.url).mockReturnValue("");

      provider.getTransformUrl("test-key", { fit: "cover" });

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "c_fill",
      });
    });

    it("should map contain to fit", () => {
      vi.mocked(cloudinary.url).mockReturnValue("");

      provider.getTransformUrl("test-key", { fit: "contain" });

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "c_fit",
      });
    });

    it("should map fill to pad", () => {
      vi.mocked(cloudinary.url).mockReturnValue("");

      provider.getTransformUrl("test-key", { fit: "fill" });

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "c_pad",
      });
    });

    it("should map inside to limit", () => {
      vi.mocked(cloudinary.url).mockReturnValue("");

      provider.getTransformUrl("test-key", { fit: "inside" });

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "c_limit",
      });
    });

    it("should map outside to crop", () => {
      vi.mocked(cloudinary.url).mockReturnValue("");

      provider.getTransformUrl("test-key", { fit: "outside" });

      expect(cloudinary.url).toHaveBeenCalledWith("test-key", {
        cloud_name: "test-cloud",
        secure: true,
        transformation: "c_crop",
      });
    });

    it("should generate URLs with each provider own cloud name", () => {
      const otherProvider = new CloudinaryProvider({
        cloudName: "other-cloud",
        apiKey: "other-api-key",
        apiSecret: "other-api-secret",
        secure: true,
      });

      vi.mocked(cloudinary.url).mockReturnValue(
        "https://res.cloudinary.com/other-cloud/image/upload/test-key",
      );

      otherProvider.getPublicUrl("test-key");

      expect(cloudinary.url).toHaveBeenLastCalledWith("test-key", {
        cloud_name: "other-cloud",
        secure: true,
      });
    });
  });

  describe("resource type contract", () => {
    it("should upload image content in the image namespace", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: "test-key" });
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");
      await provider.put("test-key", buffer, { contentType: "image/png" });

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: "test-key",
          resource_type: "image",
        },
        expect.any(Function),
      );
    });

    it.each(["video/mp4", "application/pdf"])(
      "should reject unsupported %s content before upload",
      async (contentType) => {
        await expect(
          provider.put("test-key", Buffer.from("test data"), { contentType }),
        ).rejects.toMatchObject({
          code: "storage-cloudinary/validation-failed",
          extensions: {
            key: "test-key",
            operation: "put",
            provider: "cloudinary",
            upstreamCode: "unsupported-resource-type",
          },
        });

        expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
      },
    );

    it("should reject an unsupported readable stream before consuming bytes", async () => {
      let consumed = false;
      const stream = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            consumed = true;
            controller.enqueue(Buffer.from("video data"));
            controller.close();
          },
        },
        { highWaterMark: 0 },
      );

      await expect(
        provider.put("test-key", stream, { contentType: "video/mp4" }),
      ).rejects.toMatchObject({
        code: "storage-cloudinary/validation-failed",
      });

      expect(consumed).toBe(false);
      expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
    });

    it("should preserve the accepted image lifecycle after provider reconstruction", async () => {
      useInMemoryCloudinaryBackend();
      const key = "restart/image.png";
      const data = Buffer.from("image data");

      await provider.put(key, data, { contentType: "image/png" });

      const reconstructedProvider = new CloudinaryProvider(mockConfig);
      await expect(reconstructedProvider.get(key)).resolves.toEqual(new Uint8Array(data));
      await expect(reconstructedProvider.exists(key)).resolves.toBe(true);
      await expect(reconstructedProvider.getMetadata(key)).resolves.toMatchObject({
        size: data.length,
      });
      await expect(reconstructedProvider.delete(key)).resolves.toBeUndefined();
      await expect(reconstructedProvider.exists(key)).resolves.toBe(false);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(key, {
        resource_type: "image",
      });
    });

    it("should use the image namespace when content type is not provided", async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: "test-key" });
          return {
            end: vi.fn(),
          };
        },
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        mockUploadStream as unknown as UploadStream,
      );

      const buffer = Buffer.from("test data");
      await provider.put("test-key", buffer);

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: "test-key",
          resource_type: "image",
        },
        expect.any(Function),
      );
    });
  });
});

function useInMemoryCloudinaryBackend(): void {
  const objects = new Map<string, StoredCloudinaryObject>();

  vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(((
    options: unknown,
    callback: (error: Error | undefined, result: unknown) => void,
  ) => {
    const uploadOptions = options as {
      readonly context?: string;
      readonly public_id?: string;
    };
    const destination = new PassThrough();
    const chunks: Buffer[] = [];

    destination.on("data", (chunk: Buffer | Uint8Array | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    destination.on("error", (error) => callback(error, undefined));
    destination.on("finish", () => {
      if (!uploadOptions.public_id) {
        callback(new Error("public_id is required"), undefined);
        return;
      }

      objects.set(uploadOptions.public_id, {
        context: uploadOptions.context,
        createdAt: "2026-01-01T00:00:00Z",
        data: Buffer.concat(chunks),
        etag: `${uploadOptions.public_id}:etag`,
      });
      callback(undefined, { public_id: uploadOptions.public_id });
    });

    return destination;
  }) as unknown as UploadStream);

  vi.mocked(cloudinary.uploader.destroy).mockImplementation(async (key: string) => {
    const existed = objects.delete(key);
    return { result: existed ? "ok" : "not found" };
  });

  vi.mocked(cloudinary.api.resource).mockImplementation(async (key: string) => {
    const object = objects.get(key);
    if (!object) {
      throw { http_code: 404, message: "Resource not found" };
    }

    return {
      bytes: object.data.length,
      context: object.context,
      created_at: object.createdAt,
      etag: object.etag,
    };
  });

  vi.mocked(cloudinary.url).mockImplementation((key: string, options?: unknown) => {
    const optionRecord = typeof options === "object" && options !== null ? options : undefined;
    const cloudNameValue = optionRecord ? Reflect.get(optionRecord, "cloud_name") : undefined;
    const secureValue = optionRecord ? Reflect.get(optionRecord, "secure") : undefined;
    const transformationValue = optionRecord
      ? Reflect.get(optionRecord, "transformation")
      : undefined;
    const signUrlValue = optionRecord ? Reflect.get(optionRecord, "sign_url") : undefined;
    const cloudName = typeof cloudNameValue === "string" ? cloudNameValue : "test-cloud";
    const protocol = secureValue === false ? "http" : "https";
    const transformation =
      typeof transformationValue === "string" && transformationValue.length > 0
        ? `${transformationValue}/`
        : "";
    const query = signUrlValue ? "?expires=60&s=mock-signature" : "";

    return `${protocol}://res.cloudinary.com/${cloudName}/image/upload/${transformation}${key}${query}`;
  });

  vi.mocked(global.fetch).mockImplementation(async (input: string | URL | Request) => {
    const key = parseCloudinaryDeliveryKey(String(input), "test-cloud");
    if (!key) {
      return new Response("Not found", { status: 404 });
    }

    const object = objects.get(key);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(new Uint8Array(object.data));
  });
}

function parseCloudinaryDeliveryKey(url: string, cloudName: string): string | null {
  const parsed = new URL(url);
  const marker = `/${cloudName}/image/upload/`;
  const markerIndex = parsed.pathname.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const rawKey = parsed.pathname.slice(markerIndex + marker.length);
  if (rawKey.length === 0) {
    return null;
  }

  const segments = rawKey.split("/");
  if (segments[0]?.includes("_") && segments.length > 1) {
    segments.shift();
  }

  return segments.map(decodeURIComponent).join("/");
}
