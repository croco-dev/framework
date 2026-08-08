import { Readable } from "node:stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ConfigService } from "@croco/framework-config";
import { Container } from "@croco/framework-context";
import type { Logger } from "@croco/framework-logger";
import {
  DeleteFailedProblem,
  FileNotFoundProblem,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  UploadFailedProblem,
} from "@croco/storage-core";
import { createStorageProviderConformanceSuite } from "@croco/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyR2BodyProblem } from "../libs/problems/EmptyR2BodyProblem";
import { MissingR2ConfigProblem } from "../libs/problems/MissingR2ConfigProblem";
import { R2ObjectTooLargeProblem } from "../libs/problems/R2ObjectTooLargeProblem";
import { R2StorageDiagnosticsProvider } from "../libs/R2StorageDiagnosticsProvider";
import { R2StorageProvider } from "../libs/R2StorageProvider";
import type { R2Options } from "../libs/types";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mockSend;
  },
  GetObjectCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
  PutObjectCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
  DeleteObjectCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
  HeadObjectCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: MockS3Command) => {
    return `https://signed-url.example.com/${command.input.Key}`;
  }),
}));

type MockS3Command = {
  readonly constructor: {
    readonly name: string;
  };
  readonly input: {
    readonly Body?: Buffer | Readable;
    readonly ContentType?: string;
    readonly Key?: string;
    readonly Metadata?: Record<string, string>;
  };
};

type StoredR2Object = {
  readonly data: Buffer;
  readonly contentType?: string;
  readonly lastModified: Date;
  readonly metadata?: Record<string, string>;
};

describe("R2StorageProvider", () => {
  let provider!: R2StorageProvider;
  let configService!: ConfigService;
  let logger!: Logger;

  const defaultEnvs: Record<string, string> = {
    R2_ACCOUNT_ID: "test-account-id",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_BUCKET: "test-bucket",
  };
  const defaultOptions: R2Options = {
    accountId: defaultEnvs.R2_ACCOUNT_ID,
    accessKeyId: defaultEnvs.R2_ACCESS_KEY_ID,
    secretAccessKey: defaultEnvs.R2_SECRET_ACCESS_KEY,
    bucket: defaultEnvs.R2_BUCKET,
  };

  beforeEach(() => {
    Container.reset();
    mockSend.mockReset();
    vi.mocked(getSignedUrl).mockClear();

    configService = {
      get: vi.fn((key: string) => defaultEnvs[key]),
    } as unknown as ConfigService;

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;

    provider = new R2StorageProvider(configService, logger);
  });

  describe("storage provider conformance", () => {
    it.each(
      createStorageProviderConformanceSuite({
        createProvider: () => {
          useInMemoryR2Backend();
          return provider;
        },
        keyPrefix: "r2-conformance",
        metadata: {
          contentType: "required",
          customMetadata: "required",
        },
        providerName: "storage-r2",
        publicUrl: "https://test-bucket.test-account-id.r2.dev/",
        signedUrl: "https://signed-url.example.com",
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("constructor", () => {
    it.each([["R2_ACCOUNT_ID"], ["R2_ACCESS_KEY_ID"], ["R2_SECRET_ACCESS_KEY"], ["R2_BUCKET"]])(
      "should throw MissingR2ConfigProblem when %s is missing",
      (missingKey) => {
        vi.mocked(configService.get).mockImplementation((key: string) => {
          if (key === missingKey) {
            return undefined;
          }

          return defaultEnvs[key];
        });

        expect(() => new R2StorageProvider(configService, logger)).toThrow(MissingR2ConfigProblem);
        expect(() => new R2StorageProvider(configService, logger)).toThrow(
          `Missing required R2 configuration: ${missingKey}`,
        );
      },
    );

    it("should throw MissingR2ConfigProblem with all missing keys", () => {
      vi.mocked(configService.get).mockReturnValue(undefined);

      expect(() => new R2StorageProvider(configService, logger)).toThrow(
        "Missing required R2 configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET",
      );
    });
  });

  describe("diagnostics", () => {
    it("reports missing required configuration without leaking secret values", async () => {
      const diagnostics = new R2StorageDiagnosticsProvider({
        accountId: "test-account-id",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
        bucket: "",
      });

      const health = await diagnostics.getHealth();

      expect(health).toMatchObject({
        status: "unhealthy",
        component: "storage-r2",
        details: expect.objectContaining({
          provider: "cloudflare-r2",
          hasAccountId: true,
          hasAccessKeyId: true,
          hasSecretAccessKey: true,
          hasBucket: false,
          missingConfig: ["R2_BUCKET"],
          liveCheck: "not_started",
          problemCode: "STORAGE_R2_MISSING_CONFIG",
        }),
      });
      expect(JSON.stringify(health)).not.toContain("test-access-key");
      expect(JSON.stringify(health)).not.toContain("test-secret-key");
    });

    it("reports healthy readiness when required config exists and no live check is configured", async () => {
      const diagnostics = new R2StorageDiagnosticsProvider(defaultOptions);

      const health = await diagnostics.getHealth();

      expect(health).toMatchObject({
        status: "healthy",
        component: "storage-r2",
        details: expect.objectContaining({
          provider: "cloudflare-r2",
          hasAccountId: true,
          hasAccessKeyId: true,
          hasSecretAccessKey: true,
          hasBucket: true,
          missingConfig: [],
          liveCheck: "not_configured",
        }),
      });
      expect(JSON.stringify(health)).not.toContain(defaultOptions.accessKeyId);
      expect(JSON.stringify(health)).not.toContain(defaultOptions.secretAccessKey);
    });

    it("sanitizes live readiness details before returning diagnostics", async () => {
      const controller = new AbortController();
      const diagnostics = new R2StorageDiagnosticsProvider(defaultOptions, {
        readinessCheck: async ({ config, signal }) => {
          expect(config.bucket).toBe(defaultOptions.bucket);
          expect(signal).toBe(controller.signal);

          return {
            details: {
              accessKeyId: "leaked-access-key",
              nested: {
                secretAccessKey: "leaked-secret-key",
                bucket: "visible-bucket",
              },
            },
          };
        },
      });

      const health = await diagnostics.getHealth(controller.signal);

      expect(health.status).toBe("healthy");
      expect(health.details).toMatchObject({
        liveCheck: "passed",
        readiness: {
          accessKeyId: "[redacted]",
          nested: {
            secretAccessKey: "[redacted]",
            bucket: "visible-bucket",
          },
        },
      });
      expect(JSON.stringify(health)).not.toContain("leaked-access-key");
      expect(JSON.stringify(health)).not.toContain("leaked-secret-key");
    });

    it("reports upstream readiness failures as degraded instead of falling back to healthy", async () => {
      const diagnostics = new R2StorageDiagnosticsProvider(defaultOptions, {
        readinessCheck: async () => {
          throw {
            $metadata: { httpStatusCode: 503 },
            message: `R2 unavailable for ${defaultOptions.secretAccessKey}`,
            name: "ServiceUnavailable",
          };
        },
      });

      const health = await diagnostics.getHealth();

      expect(health).toMatchObject({
        status: "degraded",
        component: "storage-r2",
        details: expect.objectContaining({
          liveCheck: "failed",
          problemCode: "STORAGE_R2_READINESS_FAILED",
          upstreamCode: "ServiceUnavailable",
          upstreamStatus: 503,
        }),
      });
      expect(JSON.stringify(health)).not.toContain(defaultOptions.secretAccessKey);
    });
  });

  describe("getPublicUrl", () => {
    it("should return default R2 public URL when publicUrlBase is not set", () => {
      const url = provider.getPublicUrl("test/file.txt");
      expect(url).toBe("https://test-bucket.test-account-id.r2.dev/test/file.txt");
    });

    it("should return custom public URL when publicUrlBase is set", () => {
      vi.mocked(configService.get).mockImplementation((key: string) => {
        if (key === "R2_PUBLIC_URL_BASE") return "https://cdn.example.com";
        if (key === "R2_BUCKET") return "test-bucket";
        return "test-value";
      });

      const customProvider = new R2StorageProvider(configService, logger);
      const url = customProvider.getPublicUrl("test/file.txt");
      expect(url).toBe("https://cdn.example.com/test/file.txt");
    });
  });

  describe("getSignedUrl", () => {
    it("should generate signed URL with expiration", async () => {
      const url = await provider.getSignedUrl("test/file.txt", {
        expiresIn: MAX_SIGNED_URL_EXPIRY_SECONDS,
      });
      expect(url).toBe("https://signed-url.example.com/test/file.txt");
      expect(vi.mocked(getSignedUrl)).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: MAX_SIGNED_URL_EXPIRY_SECONDS,
      });
    });
  });

  describe("getStream", () => {
    it("should return a readable stream from S3", async () => {
      const mockBody = Readable.from([Buffer.from("stream")]);
      mockSend.mockResolvedValue({
        Body: mockBody,
      });

      const stream = await provider.getStream("test/file.txt");
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
          continue;
        }

        if (typeof chunk === "string") {
          chunks.push(Buffer.from(chunk));
          continue;
        }

        chunks.push(Buffer.from([Number(chunk)]));
      }

      expect(Buffer.concat(chunks)).toEqual(Buffer.from("stream"));
    });

    it("should throw FileNotFoundProblem when S3 returns 404", async () => {
      mockSend.mockRejectedValue({
        $metadata: { httpStatusCode: 404 },
        name: "NotFound",
      });

      await expect(provider.getStream("test/file.txt")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should throw error when response body is empty", async () => {
      mockSend.mockResolvedValue({
        Body: undefined,
      });

      const streamPromise = provider.getStream("test/file.txt");

      await expect(streamPromise).rejects.toBeInstanceOf(EmptyR2BodyProblem);
      await expect(streamPromise).rejects.toThrow("Empty response body");
    });
  });

  describe("get", () => {
    it("should buffer a small object into a Buffer", async () => {
      mockSend.mockResolvedValue({
        Body: Readable.from([Buffer.from("hello "), Buffer.from("world")]),
      });

      const buffer = await provider.get("test/file.txt");

      expect(buffer).toEqual(Buffer.from("hello world"));
    });

    it("should throw R2ObjectTooLargeProblem when buffered bytes exceed the limit", async () => {
      const oversizedChunk = Buffer.alloc(6 * 1024 * 1024, "a");
      mockSend.mockResolvedValue({
        Body: Readable.from([oversizedChunk, oversizedChunk]),
      });

      const getPromise = provider.get("test/file.txt");

      await expect(getPromise).rejects.toThrow(R2ObjectTooLargeProblem);
      await expect(getPromise).rejects.toThrow(
        "R2 object 'test/file.txt' exceeds the in-memory download limit of 10485760 bytes",
      );
    });

    it("should retry transient get failures before succeeding", async () => {
      mockSend
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 503 }, name: "ServiceUnavailable" })
        .mockResolvedValueOnce({
          Body: Readable.from([Buffer.from("hello world")]),
        });

      const buffer = await provider.get("test/file.txt");

      expect(buffer).toEqual(Buffer.from("hello world"));
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("put", () => {
    it("should upload object data", async () => {
      mockSend.mockResolvedValue({});

      await expect(provider.put("test/file.txt", Buffer.from("data"))).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should retry transient put failures for buffers before succeeding", async () => {
      mockSend
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 503 }, name: "ServiceUnavailable" })
        .mockResolvedValueOnce({});

      await expect(provider.put("test/file.txt", Buffer.from("data"))).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("should not retry readable stream uploads on transient failures", async () => {
      mockSend.mockRejectedValueOnce({
        $metadata: { httpStatusCode: 503 },
        name: "ServiceUnavailable",
      });

      await expect(
        provider.put("test/file.txt", Readable.from([Buffer.from("data")])),
      ).rejects.toThrow(UploadFailedProblem);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete", () => {
    it("should delete an object", async () => {
      mockSend.mockResolvedValue({});

      await expect(provider.delete("test/file.txt")).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should retry transient delete failures before succeeding", async () => {
      mockSend
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 503 }, name: "ServiceUnavailable" })
        .mockResolvedValueOnce({});

      await expect(provider.delete("test/file.txt")).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("should throw DeleteFailedProblem for terminal delete failures", async () => {
      mockSend.mockRejectedValue(new Error("delete failed"));

      await expect(provider.delete("test/file.txt")).rejects.toThrow(DeleteFailedProblem);
    });
  });

  describe("getMetadata", () => {
    it("should return metadata for an object", async () => {
      const lastModified = new Date("2024-01-01T00:00:00.000Z");
      mockSend.mockResolvedValue({
        ContentLength: 123,
        ContentType: "image/png",
        LastModified: lastModified,
        ETag: "etag-123",
        Metadata: { foo: "bar" },
      });

      await expect(provider.getMetadata("test/file.txt")).resolves.toEqual({
        size: 123,
        contentType: "image/png",
        lastModified,
        etag: "etag-123",
        metadata: { foo: "bar" },
      });
    });

    it("should throw FileNotFoundProblem when metadata lookup returns 404", async () => {
      mockSend.mockRejectedValue({ $metadata: { httpStatusCode: 404 }, name: "NotFound" });

      await expect(provider.getMetadata("test/file.txt")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should retry transient metadata failures before succeeding", async () => {
      const lastModified = new Date("2024-01-01T00:00:00.000Z");
      mockSend
        .mockRejectedValueOnce({
          $metadata: { httpStatusCode: 429 },
          name: "TooManyRequestsException",
        })
        .mockResolvedValueOnce({
          ContentLength: 456,
          ContentType: "text/plain",
          LastModified: lastModified,
          ETag: "etag-456",
          Metadata: undefined,
        });

      await expect(provider.getMetadata("test/file.txt")).resolves.toEqual({
        size: 456,
        contentType: "text/plain",
        lastModified,
        etag: "etag-456",
        metadata: undefined,
      });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});

function useInMemoryR2Backend(): void {
  const objects = new Map<string, StoredR2Object>();

  mockSend.mockImplementation(async (command: MockS3Command) => {
    const key = command.input.Key;

    if (!key) {
      throw new Error("R2 command is missing Key");
    }

    if (command.constructor.name === "PutObjectCommand") {
      const body = command.input.Body;

      if (!body) {
        throw new Error("R2 PutObjectCommand is missing Body");
      }

      objects.set(key, {
        contentType: command.input.ContentType,
        data: await readBody(body),
        lastModified: new Date("2026-01-01T00:00:00.000Z"),
        metadata: command.input.Metadata,
      });
      return {};
    }

    if (command.constructor.name === "GetObjectCommand") {
      const object = objects.get(key);
      if (!object) {
        throw { $metadata: { httpStatusCode: 404 }, name: "NotFound" };
      }

      return {
        Body: Readable.from([object.data]),
      };
    }

    if (command.constructor.name === "HeadObjectCommand") {
      const object = objects.get(key);
      if (!object) {
        throw { $metadata: { httpStatusCode: 404 }, name: "NotFound" };
      }

      return {
        ContentLength: object.data.length,
        ContentType: object.contentType,
        ETag: `"${key}"`,
        LastModified: object.lastModified,
        Metadata: object.metadata,
      };
    }

    if (command.constructor.name === "DeleteObjectCommand") {
      objects.delete(key);
      return {};
    }

    throw new Error(`Unsupported R2 command: ${command.constructor.name}`);
  });
}

async function readBody(body: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
