import { Container } from "@croco/framework-context";
import { FileNotFoundProblem, UploadFailedProblem } from "@croco/storage-core";
import { createStorageProviderConformanceSuite } from "@croco/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareImagesValidationProblem } from "../libs/CloudflareImagesDiagnosticsProvider";
import { CloudflareImagesProvider } from "../libs/CloudflareImagesProvider";

type StoredCloudflareImage = {
  readonly contentType?: string;
  readonly data: Buffer;
  readonly uploaded: string;
};

describe("CloudflareImagesProvider", () => {
  let provider!: CloudflareImagesProvider;
  let mockFetch!: ReturnType<typeof vi.fn>;
  let originalFetch!: typeof global.fetch;
  let mockCryptoSign!: ReturnType<typeof vi.fn>;
  let mockCryptoImportKey!: ReturnType<typeof vi.fn>;

  const mockOptions = {
    accountId: "test-account-id",
    apiToken: "test-api-token",
    signingKey: "test-signing-key",
    accountHash: "test-account-hash",
    defaultVariant: "public",
  };

  const mockOptionsWithCustomDomain = {
    ...mockOptions,
    customDomain: "cdn.example.com",
  };

  beforeEach(() => {
    Container.reset();

    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof global.fetch;

    mockCryptoSign = vi.fn();
    mockCryptoImportKey = vi.fn();

    vi.stubGlobal("crypto", {
      subtle: {
        sign: mockCryptoSign,
        importKey: mockCryptoImportKey,
      },
    });

    provider = new CloudflareImagesProvider(mockOptions);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  describe("storage provider conformance", () => {
    it.each(
      createStorageProviderConformanceSuite({
        createProvider: () => {
          useInMemoryCloudflareImagesBackend(mockFetch, mockOptions.accountHash);
          mockCryptoImportKey.mockResolvedValue({} as CryptoKey);
          mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));
          return provider;
        },
        keyPrefix: "cloudflare-images-conformance",
        metadata: {
          contentType: "unsupported",
          customMetadata: "unsupported",
        },
        providerName: "storage-cloudflare",
        publicUrl: "https://imagedelivery.net/test-account-hash/",
        signedUrl: /signature=/,
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const newProvider = new CloudflareImagesProvider(mockOptions);
      expect(newProvider).not.toBeUndefined();
    });

    it("should initialize with custom domain", () => {
      const newProvider = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      expect(newProvider).not.toBeUndefined();
    });
  });

  describe("put", () => {
    it("should upload file successfully with Buffer", async () => {
      const mockBuffer = Buffer.from("test-image-data");
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "test.jpg",
            filename: "test.jpg",
            uploaded: new Date().toISOString(),
          },
          errors: [],
          messages: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await provider.put("test.jpg", mockBuffer, { contentType: "image/jpeg" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-token",
          },
        }),
      );

      const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(request.body).toBeInstanceOf(FormData);
      expect((request.body as FormData).get("id")).toBe("test.jpg");
    });

    it("should upload file successfully with Readable stream", async () => {
      const { Readable } = await import("node:stream");
      const mockStream = Readable.from(Buffer.from("test-image-data"));

      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "test.jpg",
            filename: "test.jpg",
            uploaded: new Date().toISOString(),
          },
          errors: [],
          messages: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await provider.put("test.jpg", mockStream);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(request.body).toBeInstanceOf(FormData);
      expect((request.body as FormData).get("id")).toBe("test.jpg");
    });

    it.each([
      ["ASCII", "a".repeat(1024)],
      ["astral Unicode", "🦊".repeat(1024)],
    ])("should accept a 1,024-code-point %s image id", async (_label, key) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { id: key },
          errors: [],
          messages: [],
        }),
      });

      await provider.put(key, Buffer.from("test-image-data"));

      const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect((request.body as FormData).get("id")).toBe(key);
    });

    it.each([
      ["ASCII", "a".repeat(1025)],
      ["astral Unicode", "🦊".repeat(1025)],
    ])("should reject a 1,025-code-point %s image id before upload", async (_label, key) => {
      await expect(provider.put(key, Buffer.from("test-image-data"))).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
        extensions: {
          operation: "put",
          upstreamCode: "image-id-too-long",
        },
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([
      ["lone high surrogate", String.fromCharCode(0xd800)],
      ["lone low surrogate", String.fromCharCode(0xdc00)],
    ])("should reject a %s image id before upload", async (_label, key) => {
      await expect(provider.put(key, Buffer.from("test-image-data"))).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
        extensions: {
          operation: "put",
          upstreamCode: "image-id-invalid-unicode",
        },
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject an unsupported image id before consuming a stream", async () => {
      const { Readable } = await import("node:stream");
      let consumed = false;
      const stream = Readable.from(
        (async function* () {
          consumed = true;
          yield Buffer.from("test-image-data");
        })(),
      );

      await expect(provider.put("a".repeat(1025), stream)).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
        extensions: {
          upstreamCode: "image-id-too-long",
        },
      });
      expect(consumed).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject ill-formed Unicode before consuming a stream", async () => {
      const { Readable } = await import("node:stream");
      let consumed = false;
      const stream = Readable.from(
        (async function* () {
          consumed = true;
          yield Buffer.from("test-image-data");
        })(),
      );

      await expect(provider.put(String.fromCharCode(0xd800), stream)).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
        extensions: {
          upstreamCode: "image-id-invalid-unicode",
        },
      });
      expect(consumed).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([
      ["missing", {}],
      ["null", null],
      ["non-string", { id: 42 }],
      ["mismatched", { id: "generated-image-id" }],
    ])("should reject a %s returned image id", async (_label, returnedResult) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: returnedResult,
          errors: [],
          messages: [],
        }),
      });

      await expect(provider.put("test.jpg", Buffer.from("test-image-data"))).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
        extensions: {
          key: "test.jpg",
          operation: "put",
          upstreamCode: "image-id-mismatch",
        },
      });
    });

    it("should throw UploadFailedProblem when stream exceeds maxUploadBytes", async () => {
      const { Readable } = await import("node:stream");
      const providerWithLimit = new CloudflareImagesProvider({
        ...mockOptions,
        maxUploadBytes: 4,
      });
      const mockStream = Readable.from([Buffer.from("1234"), Buffer.from("5")]);

      await expect(providerWithLimit.put("test.jpg", mockStream)).rejects.toThrow(
        UploadFailedProblem,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should throw terminal provider Problem when API returns error", async () => {
      const mockBuffer = Buffer.from("test-image-data");
      const mockResponse = {
        ok: false,
        text: async () => "Unauthorized",
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.put("test.jpg", mockBuffer)).rejects.toMatchObject({
        code: "storage-cloudflare/terminal-upstream",
      });
    });

    it("should throw validation provider Problem when response success is false", async () => {
      const mockBuffer = Buffer.from("test-image-data");
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          errors: ["Invalid file format"],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.put("test.jpg", mockBuffer)).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
      });
    });

    it.each([
      ["invalid JSON", async () => Promise.reject(new SyntaxError("Unexpected token"))],
      ["missing success", async () => ({ errors: [] })],
      ["missing errors", async () => ({ success: false })],
      ["non-array errors", async () => ({ success: false, errors: "Invalid file" })],
      ["invalid result shape", async () => ({ success: true, errors: [], result: [] })],
    ])("should convert a %s upload response into a provider Problem", async (_label, json) => {
      mockFetch.mockResolvedValueOnce({ ok: true, json });

      await expect(provider.put("test.jpg", Buffer.from("test-image-data"))).rejects.toMatchObject({
        code: "storage-cloudflare/terminal-upstream",
        extensions: {
          operation: "put",
          upstreamCode: "invalid-response",
        },
      });
    });
  });

  describe("get", () => {
    it("should download image successfully", async () => {
      const mockImageData = Buffer.from("mock-image-data");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new Uint8Array(mockImageData).buffer,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await provider.get("test-image-id");

      expect(result).toEqual(mockImageData);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://imagedelivery.net/test-account-hash/test-image-id/public",
      );
    });

    it("should throw FileNotFoundProblem when image not found (404)", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.get("non-existent-id")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should use custom domain when configured", async () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const mockImageData = Buffer.from("mock-image-data");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new Uint8Array(mockImageData).buffer,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await providerWithCustomDomain.get("test-image-id");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cdn.example.com/cdn-cgi/imagedelivery/test-account-hash/test-image-id/public",
      );
    });
  });

  describe("getStream", () => {
    it("should return readable stream", async () => {
      const mockImageData = Buffer.from("mock-image-data");
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new Uint8Array(mockImageData).buffer,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const stream = await provider.getStream("test-image-id");

      expect(stream).not.toBeUndefined();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks)).toEqual(mockImageData);
    });
  });

  describe("delete", () => {
    it("should delete image successfully", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await provider.delete("test-image-id");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/test-image-id",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            Authorization: "Bearer test-api-token",
          },
        }),
      );
    });

    it("should throw terminal provider Problem when delete fails", async () => {
      const mockResponse = {
        ok: false,
        text: async () => "Not found",
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.delete("test-image-id")).rejects.toMatchObject({
        code: "storage-cloudflare/terminal-upstream",
      });
    });

    it("should throw validation provider Problem when response success is false", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          errors: ["Image not found"],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.delete("test-image-id")).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
      });
    });

    it("should encode the complete image id as one management path parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, errors: [] }),
      });

      await provider.delete("folder/50% café?#.jpg");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/folder%2F50%25%20caf%C3%A9%3F%23.jpg",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("exists", () => {
    it("should return true when image exists", async () => {
      const mockResponse = new Response(new Uint8Array([1, 2, 3]));

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await provider.exists("test-image-id");

      expect(result).toBe(true);
    });

    it("should return false when image does not exist", async () => {
      const mockResponse = {
        status: 404,
        ok: false,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await provider.exists("non-existent-id");

      expect(result).toBe(false);
    });

    it("should propagate non-404 errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.exists("test-image-id")).rejects.toMatchObject({
        code: "storage-cloudflare/retryable-upstream",
      });
    });
  });

  describe("getPublicUrl", () => {
    it("should return public URL with default variant", () => {
      const url = provider.getPublicUrl("test-image-id");

      expect(url).toBe("https://imagedelivery.net/test-account-hash/test-image-id/public");
    });

    it("should return public URL with custom domain", () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const url = providerWithCustomDomain.getPublicUrl("test-image-id");

      expect(url).toBe(
        "https://cdn.example.com/cdn-cgi/imagedelivery/test-account-hash/test-image-id/public",
      );
    });

    it("should use custom default variant", () => {
      const providerWithVariant = new CloudflareImagesProvider({
        ...mockOptions,
        defaultVariant: "thumbnail",
      });
      const url = providerWithVariant.getPublicUrl("test-image-id");

      expect(url).toBe("https://imagedelivery.net/test-account-hash/test-image-id/thumbnail");
    });

    it("should preserve subpaths while encoding each delivery path segment", () => {
      const url = provider.getPublicUrl("folder/50% café?#.jpg");

      expect(url).toBe(
        "https://imagedelivery.net/test-account-hash/folder/50%25%20caf%C3%A9%3F%23.jpg/public",
      );
    });

    it.each([
      ["public", (key: string) => provider.getPublicUrl(key)],
      ["transform", (key: string) => provider.getTransformUrl(key, { width: 800 })],
    ])("should reject ill-formed Unicode before %s URL generation", (_label, buildUrl) => {
      expect(() => buildUrl(String.fromCharCode(0xd800))).toThrow(
        CloudflareImagesValidationProblem,
      );
    });
  });

  describe("getSignedUrl", () => {
    beforeEach(() => {
      const mockKey = {} as CryptoKey;
      mockCryptoImportKey.mockResolvedValue(mockKey);
      mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));
    });

    it("should generate signed URL with HMAC signature", async () => {
      const mockSignature = Buffer.alloc(32, "ab").toString("hex");
      mockCryptoSign.mockResolvedValue(new Uint8Array(Buffer.from(mockSignature, "hex")).buffer);

      const url = await provider.getSignedUrl("test-image-id", { expiresIn: 3600 });

      expect(url).toContain("https://imagedelivery.net/test-account-hash/test-image-id/public");
      expect(url).toContain("expires=");
      expect(url).toContain("signature=");
    });

    it("should include correct expiration timestamp", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));

      const url = await provider.getSignedUrl("test-image-id", { expiresIn: 3600 });
      const expectedExpires = Math.floor(now / 1000) + 3600;

      expect(url).toContain(`expires=${expectedExpires}`);

      vi.restoreAllMocks();
    });

    it("should use custom domain when configured", async () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const mockKey = {} as CryptoKey;
      mockCryptoImportKey.mockResolvedValue(mockKey);
      mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));

      const url = await providerWithCustomDomain.getSignedUrl("test-image-id", { expiresIn: 3600 });

      expect(url).toContain("cdn.example.com");
    });

    it("should encode delivery path segments without changing the logical signature key", async () => {
      const url = await provider.getSignedUrl("folder/50% café?#.jpg", { expiresIn: 3600 });

      expect(url).toContain(
        "https://imagedelivery.net/test-account-hash/folder/50%25%20caf%C3%A9%3F%23.jpg/public",
      );
      const signedData = mockCryptoSign.mock.calls[0]?.[2] as Uint8Array;
      expect(new TextDecoder().decode(signedData)).toContain("folder/50% café?#.jpg:");
    });

    it("should throw validation provider Problem when signingKey is missing", async () => {
      const providerWithoutSigningKey = new CloudflareImagesProvider({
        accountId: "test-account-id",
        apiToken: "test-api-token",
        accountHash: "test-account-hash",
        defaultVariant: "public",
      });

      await expect(
        providerWithoutSigningKey.getSignedUrl("test-image-id", { expiresIn: 3600 }),
      ).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
      });
    });
  });

  describe("getMetadata", () => {
    it("should return image metadata", async () => {
      const mockUploadedDate = new Date().toISOString();
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "test-image-id",
            filename: "test.jpg",
            uploaded: mockUploadedDate,
            size: 2048,
            variants: [],
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const metadata = await provider.getMetadata("test-image-id");

      expect(metadata).toEqual({
        size: 2048,
        lastModified: new Date(mockUploadedDate),
      });
    });

    it("should throw FileNotFoundProblem when image not found (404)", async () => {
      const mockResponse = {
        status: 404,
        ok: false,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getMetadata("non-existent-id")).rejects.toThrow(FileNotFoundProblem);
    });

    it("should throw terminal provider Problem when API returns error", async () => {
      const mockResponse = {
        ok: false,
        text: async () => "Unauthorized",
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getMetadata("test-image-id")).rejects.toMatchObject({
        code: "storage-cloudflare/terminal-upstream",
      });
    });

    it("should handle missing size field", async () => {
      const mockUploadedDate = new Date().toISOString();
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "test-image-id",
            filename: "test.jpg",
            uploaded: mockUploadedDate,
            variants: [],
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const metadata = await provider.getMetadata("test-image-id");

      expect(metadata.size).toBe(0);
    });

    it("should throw Problem when API returns null result", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: null,
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);
      const metadata = provider.getMetadata("test-image-id");

      await expect(metadata).rejects.toThrow();
      await expect(metadata).rejects.toMatchObject({
        code: "cloudflare/images-null-result",
      });
    });

    it("should encode the complete image id for metadata lookup", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: "folder/50% café?#.jpg",
            filename: "image.jpg",
            uploaded: "2026-01-01T00:00:00.000Z",
            variants: [],
          },
          errors: [],
        }),
      });

      await provider.getMetadata("folder/50% café?#.jpg");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/folder%2F50%25%20caf%C3%A9%3F%23.jpg",
        expect.any(Object),
      );
    });
  });

  describe("getTransformUrl", () => {
    it("should return URL without transformations when no options provided", () => {
      const url = provider.getTransformUrl("test-image-id", {});

      expect(url).toBe("https://imagedelivery.net/test-account-hash/test-image-id/public");
    });

    it("should return URL with width transformation", () => {
      const url = provider.getTransformUrl("test-image-id", { width: 800 });

      expect(url).toBe(
        "https://imagedelivery.net/cdn-cgi/image/width=800/test-account-hash/test-image-id/public",
      );
    });

    it("should return URL with height transformation", () => {
      const url = provider.getTransformUrl("test-image-id", { height: 600 });

      expect(url).toContain("height=600");
    });

    it("should return URL with quality transformation", () => {
      const url = provider.getTransformUrl("test-image-id", { quality: 85 });

      expect(url).toContain("quality=85");
    });

    it("should return URL with format transformation", () => {
      const url = provider.getTransformUrl("test-image-id", { format: "webp" });

      expect(url).toContain("format=webp");
    });

    it("should return URL with dpr transformation", () => {
      const url = provider.getTransformUrl("test-image-id", { dpr: 2 });

      expect(url).toContain("dpr=2");
    });

    it("should return URL with fit cover transformation", () => {
      const url = provider.getTransformUrl("test-image-id", { fit: "cover" });

      expect(url).toContain("fit=cover");
    });

    it("should map fit inside to scale-down", () => {
      const url = provider.getTransformUrl("test-image-id", { fit: "inside" });

      expect(url).toContain("fit=scale-down");
    });

    it("should map fit outside to cover", () => {
      const url = provider.getTransformUrl("test-image-id", { fit: "outside" });

      expect(url).toContain("fit=cover");
    });

    it("should map format jpg to jpeg", () => {
      const url = provider.getTransformUrl("test-image-id", { format: "jpg" });

      expect(url).toContain("format=jpeg");
    });

    it("should handle auto format (no format param)", () => {
      const url = provider.getTransformUrl("test-image-id", { format: "auto" });

      expect(url).not.toContain("format=");
    });

    it("should return URL with multiple transformations", () => {
      const url = provider.getTransformUrl("test-image-id", {
        width: 800,
        height: 600,
        quality: 85,
        format: "webp",
      });

      expect(url).toContain("width=800");
      expect(url).toContain("height=600");
      expect(url).toContain("quality=85");
      expect(url).toContain("format=webp");
    });

    it("should use custom domain when configured", () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const url = providerWithCustomDomain.getTransformUrl("test-image-id", { width: 800 });

      expect(url).toBe(
        "https://cdn.example.com/cdn-cgi/image/width=800/test-account-hash/test-image-id/public",
      );
    });

    it("should keep the same transform path shape across default and custom domains", () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const defaultUrl = provider.getTransformUrl("test-image-id", { width: 800, quality: 85 });
      const customUrl = providerWithCustomDomain.getTransformUrl("test-image-id", {
        width: 800,
        quality: 85,
      });

      expect(defaultUrl).toBe(
        "https://imagedelivery.net/cdn-cgi/image/width=800,quality=85/test-account-hash/test-image-id/public",
      );
      expect(customUrl).toBe(
        "https://cdn.example.com/cdn-cgi/image/width=800,quality=85/test-account-hash/test-image-id/public",
      );
    });

    it("should preserve subpaths while encoding transformed delivery URLs", () => {
      const url = provider.getTransformUrl("folder/50% café?#.jpg", { width: 800 });

      expect(url).toBe(
        "https://imagedelivery.net/cdn-cgi/image/width=800/test-account-hash/folder/50%25%20caf%C3%A9%3F%23.jpg/public",
      );
    });
  });

  describe("caller key lifecycle", () => {
    it("should use the multipart image id for buffer round trips", async () => {
      useInMemoryCloudflareImagesBackend(mockFetch, mockOptions.accountHash);
      const key = "avatars/user 100%.jpg";
      const data = Buffer.from("buffer-image-data");

      await provider.put(key, data, { contentType: "image/jpeg" });

      await expect(provider.get(key)).resolves.toEqual(data);
      await expect(provider.getMetadata(key)).resolves.toMatchObject({ size: data.length });
      await provider.delete(key);
      await expect(provider.exists(key)).resolves.toBe(false);
    });

    it("should use the multipart image id for stream round trips", async () => {
      const { Readable } = await import("node:stream");
      useInMemoryCloudflareImagesBackend(mockFetch, mockOptions.accountHash);
      const key = "streams/🦊 image.jpg";
      const data = Buffer.from("stream-image-data");

      await provider.put(key, Readable.from(data), { contentType: "image/jpeg" });

      await expect(provider.get(key)).resolves.toEqual(data);
      await expect(provider.getMetadata(key)).resolves.toMatchObject({ size: data.length });
      await provider.delete(key);
      await expect(provider.exists(key)).resolves.toBe(false);
    });
  });

  describe("caller key validation", () => {
    it.each([".", "..", "folder/../image.jpg", "folder/./image.jpg"])(
      "should reject dot-segment key %s before URL construction",
      async (key) => {
        expect(() => provider.getPublicUrl(key)).toThrow(CloudflareImagesValidationProblem);
        await expect(provider.delete(key)).rejects.toMatchObject({
          code: "storage-cloudflare/validation-failed",
          extensions: {
            operation: "delete",
            upstreamCode: "image-id-dot-segment",
          },
        });
        expect(mockFetch).not.toHaveBeenCalled();
      },
    );

    it("should reject a dot-segment upload key before creating a request", async () => {
      await expect(provider.put("folder/../image.jpg", Buffer.from("image"))).rejects.toMatchObject(
        {
          code: "storage-cloudflare/validation-failed",
          extensions: {
            operation: "put",
            upstreamCode: "image-id-dot-segment",
          },
        },
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getUploadIntent", () => {
    it("should generate upload intent successfully", async () => {
      const mockUploadUrl = "https://upload.cloudflare.com/example";
      const mockImageId = "uploaded-image-id";
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            uploadURL: mockUploadUrl,
            id: mockImageId,
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const intent = await provider.getUploadIntent("new-image.jpg");

      expect(intent.uploadUrl).toBe(mockUploadUrl);
      expect(intent.publicUrl).toBe(
        "https://imagedelivery.net/test-account-hash/uploaded-image-id/public",
      );
      expect(intent.expiresAt).toBeInstanceOf(Date);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/direct_upload",
        expect.objectContaining({
          body: JSON.stringify({
            maxDurationSeconds: 3600,
            metadata: {
              originalKey: "new-image.jpg",
            },
          }),
        }),
      );
    });

    it("should apply ttlInSeconds option to upload intent", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            uploadURL: "https://upload.cloudflare.com/example",
            id: "uploaded-image-id",
          },
          errors: [],
        }),
      });

      const intent = await provider.getUploadIntent("new-image.jpg", { ttlInSeconds: 120 });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/direct_upload",
        expect.objectContaining({
          body: JSON.stringify({
            maxDurationSeconds: 120,
            metadata: {
              originalKey: "new-image.jpg",
            },
          }),
        }),
      );
      expect(intent.expiresAt.getTime()).toBe(now + 120 * 1000);

      vi.restoreAllMocks();
    });

    it("should throw Problem when ttlInSeconds is zero or negative", async () => {
      await expect(
        provider.getUploadIntent("new-image.jpg", { ttlInSeconds: 0 }),
      ).rejects.toMatchObject({
        code: "storage/invalid-upload-intent-ttl",
      });
      await expect(
        provider.getUploadIntent("new-image.jpg", { ttlInSeconds: -1 }),
      ).rejects.toMatchObject({
        code: "storage/invalid-upload-intent-ttl",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should throw Problem when ttlInSeconds is not a finite integer", async () => {
      for (const ttlInSeconds of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
        await expect(
          provider.getUploadIntent("new-image.jpg", { ttlInSeconds }),
        ).rejects.toMatchObject({
          code: "storage/invalid-upload-intent-ttl",
        });
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should throw terminal provider Problem when API returns error", async () => {
      const mockResponse = {
        ok: false,
        text: async () => "Unauthorized",
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getUploadIntent("new-image.jpg")).rejects.toMatchObject({
        code: "storage-cloudflare/terminal-upstream",
      });
    });

    it("should throw validation provider Problem when response success is false", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          errors: ["Invalid request"],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getUploadIntent("new-image.jpg")).rejects.toMatchObject({
        code: "storage-cloudflare/validation-failed",
      });
    });

    it.each([
      ["invalid JSON", async () => Promise.reject(new SyntaxError("Unexpected token"))],
      ["missing success", async () => ({ errors: [] })],
      ["missing errors", async () => ({ success: false })],
      ["non-array errors", async () => ({ success: false, errors: "Invalid request" })],
      ["invalid result shape", async () => ({ success: true, errors: [], result: [] })],
    ])(
      "should convert a %s upload-intent response into a provider Problem",
      async (_label, json) => {
        mockFetch.mockResolvedValueOnce({ ok: true, json });

        await expect(provider.getUploadIntent("new-image.jpg")).rejects.toMatchObject({
          code: "storage-cloudflare/terminal-upstream",
          extensions: {
            operation: "upload-intent",
            upstreamCode: "invalid-response",
          },
        });
      },
    );

    it.each([
      ["missing upload URL", { id: "uploaded-image-id" }],
      ["non-string upload URL", { uploadURL: 42, id: "uploaded-image-id" }],
      ["missing image id", { uploadURL: "https://upload.cloudflare.com/example" }],
      ["non-string image id", { uploadURL: "https://upload.cloudflare.com/example", id: 42 }],
    ])("should reject a %s in a successful upload-intent response", async (_label, result) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, errors: [], result }),
      });

      await expect(provider.getUploadIntent("new-image.jpg")).rejects.toMatchObject({
        code: "storage-cloudflare/terminal-upstream",
        extensions: {
          operation: "upload-intent",
          upstreamCode: "invalid-response",
        },
      });
    });

    it("should use custom domain for publicUrl when configured", async () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const mockUploadUrl = "https://upload.cloudflare.com/example";
      const mockImageId = "uploaded-image-id";
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            uploadURL: mockUploadUrl,
            id: mockImageId,
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const intent = await providerWithCustomDomain.getUploadIntent("new-image.jpg");

      expect(intent.publicUrl).toContain("cdn.example.com");
    });

    it("should set correct expiration time (1 hour from now)", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const mockUploadUrl = "https://upload.cloudflare.com/example";
      const mockImageId = "uploaded-image-id";
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            uploadURL: mockUploadUrl,
            id: mockImageId,
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const intent = await provider.getUploadIntent("new-image.jpg");
      const expectedExpires = new Date(now + 3600 * 1000);

      expect(intent.expiresAt.getTime()).toBeCloseTo(expectedExpires.getTime(), -3);

      vi.restoreAllMocks();
    });

    it("should throw Problem when API returns null result", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: null,
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);
      const intent = provider.getUploadIntent("new-image.jpg");

      await expect(intent).rejects.toThrow("Cloudflare Images API returned null result");
      await expect(intent).rejects.toMatchObject({
        code: "cloudflare/images-upload-intent-null-result",
      });
    });
  });
});

function useInMemoryCloudflareImagesBackend(
  fetchMock: ReturnType<typeof vi.fn>,
  accountHash: string,
): void {
  const images = new Map<string, StoredCloudflareImage>();

  fetchMock.mockImplementation(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (method === "POST" && url.endsWith("/images/v1")) {
      const body = init?.body;
      if (!(body instanceof FormData)) {
        return jsonResponse({ success: false, errors: ["missing form data"] }, 400);
      }

      const file = body.get("file");
      if (!(file instanceof File)) {
        return jsonResponse({ success: false, errors: ["missing file"] }, 400);
      }

      const imageId = body.get("id");
      if (typeof imageId !== "string" || imageId.length === 0) {
        return jsonResponse({ success: false, errors: ["missing image id"] }, 400);
      }

      images.set(imageId, {
        contentType: file.type || undefined,
        data: Buffer.from(await file.arrayBuffer()),
        uploaded: "2026-01-01T00:00:00.000Z",
      });

      return jsonResponse({
        success: true,
        result: {
          filename: file.name,
          id: imageId,
          uploaded: "2026-01-01T00:00:00.000Z",
        },
        errors: [],
        messages: [],
      });
    }

    if (method === "DELETE" && url.includes("/images/v1/")) {
      images.delete(decodeURIComponent(url.split("/images/v1/")[1] ?? ""));
      return jsonResponse({ success: true, errors: [] });
    }

    if (method === "GET" && url.includes("/images/v1/")) {
      const key = decodeURIComponent(url.split("/images/v1/")[1] ?? "");
      const image = images.get(key);
      if (!image) {
        return new Response(null, { status: 404 });
      }

      return jsonResponse({
        success: true,
        result: {
          filename: key,
          id: key,
          size: image.data.length,
          uploaded: image.uploaded,
          variants: [],
        },
        errors: [],
      });
    }

    const imageKey = parseCloudflareDeliveryKey(url, accountHash);
    if (imageKey) {
      const image = images.get(imageKey);
      if (!image) {
        return new Response(null, { status: 404 });
      }

      return new Response(new Uint8Array(image.data), {
        headers: image.contentType ? { "Content-Type": image.contentType } : undefined,
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

function parseCloudflareDeliveryKey(url: string, accountHash: string): string | null {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const accountHashIndex = segments.indexOf(accountHash);

  if (accountHashIndex === -1 || accountHashIndex + 2 > segments.length) {
    return null;
  }

  const keySegments = segments.slice(accountHashIndex + 1, -1);
  if (keySegments.length === 0) {
    return null;
  }

  return keySegments.map(decodeURIComponent).join("/");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
