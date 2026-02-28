import { Container } from '@croco/framework-context';
import { DeleteFailedProblem, FileNotFoundProblem, UploadFailedProblem } from '@croco/storage-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareImagesProvider } from '../libs/CloudflareImagesProvider';

describe('CloudflareImagesProvider', () => {
  let provider!: CloudflareImagesProvider;
  let mockFetch!: ReturnType<typeof vi.fn>;
  let originalFetch!: typeof global.fetch;
  let mockCryptoSign!: ReturnType<typeof vi.fn>;
  let mockCryptoImportKey!: ReturnType<typeof vi.fn>;

  const mockOptions = {
    accountId: 'test-account-id',
    apiToken: 'test-api-token',
    accountHash: 'test-account-hash',
    defaultVariant: 'public',
  };

  const mockOptionsWithCustomDomain = {
    ...mockOptions,
    customDomain: 'cdn.example.com',
  };

  beforeEach(() => {
    Container.reset();

    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof global.fetch;

    mockCryptoSign = vi.fn();
    mockCryptoImportKey = vi.fn();

    vi.stubGlobal('crypto', {
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

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const newProvider = new CloudflareImagesProvider(mockOptions);
      expect(newProvider).not.toBeUndefined();
    });

    it('should initialize with custom domain', () => {
      const newProvider = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      expect(newProvider).not.toBeUndefined();
    });
  });

  describe('put', () => {
    it('should upload file successfully with Buffer', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: 'test-image-id',
            filename: 'test.jpg',
            uploaded: new Date().toISOString(),
          },
          errors: [],
          messages: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await provider.put('test.jpg', mockBuffer, { contentType: 'image/jpeg' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-token',
          },
        })
      );
    });

    it('should upload file successfully with Readable stream', async () => {
      const { Readable } = await import('node:stream');
      const mockStream = Readable.from(Buffer.from('test-image-data'));

      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: 'test-image-id',
            filename: 'test.jpg',
            uploaded: new Date().toISOString(),
          },
          errors: [],
          messages: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await provider.put('test.jpg', mockStream);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw UploadFailedProblem when API returns error', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockResponse = {
        ok: false,
        text: async () => 'Unauthorized',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.put('test.jpg', mockBuffer)).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw UploadFailedProblem when response success is false', async () => {
      const mockBuffer = Buffer.from('test-image-data');
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          errors: ['Invalid file format'],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.put('test.jpg', mockBuffer)).rejects.toThrow(UploadFailedProblem);
    });
  });

  describe('get', () => {
    it('should download image successfully', async () => {
      const mockImageData = Buffer.from('mock-image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new Uint8Array(mockImageData).buffer,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await provider.get('test-image-id');

      expect(result).toEqual(mockImageData);
      expect(mockFetch).toHaveBeenCalledWith('https://imagedelivery.net/test-account-hash/test-image-id/public');
    });

    it('should throw FileNotFoundProblem when image not found (404)', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.get('non-existent-id')).rejects.toThrow(FileNotFoundProblem);
    });

    it('should use custom domain when configured', async () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const mockImageData = Buffer.from('mock-image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new Uint8Array(mockImageData).buffer,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await providerWithCustomDomain.get('test-image-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/cdn-cgi/imagedelivery/test-account-hash/test-image-id/public'
      );
    });
  });

  describe('getStream', () => {
    it('should return readable stream', async () => {
      const mockImageData = Buffer.from('mock-image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => new Uint8Array(mockImageData).buffer,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const stream = await provider.getStream('test-image-id');

      expect(stream).not.toBeUndefined();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks)).toEqual(mockImageData);
    });
  });

  describe('delete', () => {
    it('should delete image successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await provider.delete('test-image-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1/test-image-id',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer test-api-token',
          },
        })
      );
    });

    it('should throw DeleteFailedProblem when delete fails', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Not found',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.delete('test-image-id')).rejects.toThrow(DeleteFailedProblem);
    });

    it('should throw DeleteFailedProblem when response success is false', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          errors: ['Image not found'],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.delete('test-image-id')).rejects.toThrow(DeleteFailedProblem);
    });
  });

  describe('exists', () => {
    it('should return true when image exists', async () => {
      const mockResponse = new Response(new Uint8Array([1, 2, 3]));

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await provider.exists('test-image-id');

      expect(result).toBe(true);
    });

    it('should return false when image does not exist', async () => {
      const mockResponse = {
        status: 404,
        ok: false,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await provider.exists('non-existent-id');

      expect(result).toBe(false);
    });

    it('should propagate non-404 errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.exists('test-image-id')).rejects.toThrow(UploadFailedProblem);
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL with default variant', () => {
      const url = provider.getPublicUrl('test-image-id');

      expect(url).toBe('https://imagedelivery.net/test-account-hash/test-image-id/public');
    });

    it('should return public URL with custom domain', () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const url = providerWithCustomDomain.getPublicUrl('test-image-id');

      expect(url).toBe('https://cdn.example.com/cdn-cgi/imagedelivery/test-account-hash/test-image-id/public');
    });

    it('should use custom default variant', () => {
      const providerWithVariant = new CloudflareImagesProvider({
        ...mockOptions,
        defaultVariant: 'thumbnail',
      });
      const url = providerWithVariant.getPublicUrl('test-image-id');

      expect(url).toBe('https://imagedelivery.net/test-account-hash/test-image-id/thumbnail');
    });
  });

  describe('getSignedUrl', () => {
    beforeEach(() => {
      const mockKey = {} as CryptoKey;
      mockCryptoImportKey.mockResolvedValue(mockKey);
      mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));
    });

    it('should generate signed URL with HMAC signature', async () => {
      const mockSignature = Buffer.alloc(32, 'ab').toString('hex');
      mockCryptoSign.mockResolvedValue(new Uint8Array(Buffer.from(mockSignature, 'hex')).buffer);

      const url = await provider.getSignedUrl('test-image-id', { expiresIn: 3600 });

      expect(url).toContain('https://imagedelivery.net/test-account-hash/test-image-id/public');
      expect(url).toContain('expires=');
      expect(url).toContain('signature=');
    });

    it('should include correct expiration timestamp', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));

      const url = await provider.getSignedUrl('test-image-id', { expiresIn: 3600 });
      const expectedExpires = Math.floor(now / 1000) + 3600;

      expect(url).toContain(`expires=${expectedExpires}`);

      vi.restoreAllMocks();
    });

    it('should use custom domain when configured', async () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const mockKey = {} as CryptoKey;
      mockCryptoImportKey.mockResolvedValue(mockKey);
      mockCryptoSign.mockResolvedValue(new ArrayBuffer(32));

      const url = await providerWithCustomDomain.getSignedUrl('test-image-id', { expiresIn: 3600 });

      expect(url).toContain('cdn.example.com');
    });
  });

  describe('getMetadata', () => {
    it('should return image metadata', async () => {
      const mockUploadedDate = new Date().toISOString();
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: 'test-image-id',
            filename: 'test.jpg',
            uploaded: mockUploadedDate,
            size: 2048,
            variants: [],
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const metadata = await provider.getMetadata('test-image-id');

      expect(metadata).toEqual({
        size: 2048,
        lastModified: new Date(mockUploadedDate),
      });
    });

    it('should throw FileNotFoundProblem when image not found (404)', async () => {
      const mockResponse = {
        status: 404,
        ok: false,
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getMetadata('non-existent-id')).rejects.toThrow(FileNotFoundProblem);
    });

    it('should throw UploadFailedProblem when API returns error', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Unauthorized',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getMetadata('test-image-id')).rejects.toThrow(UploadFailedProblem);
    });

    it('should handle missing size field', async () => {
      const mockUploadedDate = new Date().toISOString();
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: 'test-image-id',
            filename: 'test.jpg',
            uploaded: mockUploadedDate,
            variants: [],
          },
          errors: [],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const metadata = await provider.getMetadata('test-image-id');

      expect(metadata.size).toBe(0);
    });
  });

  describe('getTransformUrl', () => {
    it('should return URL without transformations when no options provided', () => {
      const url = provider.getTransformUrl('test-image-id', {});

      expect(url).toBe('https://imagedelivery.net/test-account-hash/test-image-id/public');
    });

    it('should return URL with width transformation', () => {
      const url = provider.getTransformUrl('test-image-id', { width: 800 });

      expect(url).toContain('width=800');
    });

    it('should return URL with height transformation', () => {
      const url = provider.getTransformUrl('test-image-id', { height: 600 });

      expect(url).toContain('height=600');
    });

    it('should return URL with quality transformation', () => {
      const url = provider.getTransformUrl('test-image-id', { quality: 85 });

      expect(url).toContain('quality=85');
    });

    it('should return URL with format transformation', () => {
      const url = provider.getTransformUrl('test-image-id', { format: 'webp' });

      expect(url).toContain('format=webp');
    });

    it('should return URL with dpr transformation', () => {
      const url = provider.getTransformUrl('test-image-id', { dpr: 2 });

      expect(url).toContain('dpr=2');
    });

    it('should return URL with fit cover transformation', () => {
      const url = provider.getTransformUrl('test-image-id', { fit: 'cover' });

      expect(url).toContain('fit=cover');
    });

    it('should map fit inside to scale-down', () => {
      const url = provider.getTransformUrl('test-image-id', { fit: 'inside' });

      expect(url).toContain('fit=scale-down');
    });

    it('should map fit outside to cover', () => {
      const url = provider.getTransformUrl('test-image-id', { fit: 'outside' });

      expect(url).toContain('fit=cover');
    });

    it('should map format jpg to jpeg', () => {
      const url = provider.getTransformUrl('test-image-id', { format: 'jpg' });

      expect(url).toContain('format=jpeg');
    });

    it('should handle auto format (no format param)', () => {
      const url = provider.getTransformUrl('test-image-id', { format: 'auto' });

      expect(url).not.toContain('format=');
    });

    it('should return URL with multiple transformations', () => {
      const url = provider.getTransformUrl('test-image-id', {
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp',
      });

      expect(url).toContain('width=800');
      expect(url).toContain('height=600');
      expect(url).toContain('quality=85');
      expect(url).toContain('format=webp');
    });

    it('should use custom domain when configured', () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const url = providerWithCustomDomain.getTransformUrl('test-image-id', { width: 800 });

      expect(url).toContain('cdn.example.com');
      expect(url).toContain('/cdn-cgi/image/');
      expect(url).not.toContain('imagedelivery.net');
    });
  });

  describe('getUploadIntent', () => {
    it('should generate upload intent successfully', async () => {
      const mockUploadUrl = 'https://upload.cloudflare.com/example';
      const mockImageId = 'uploaded-image-id';
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

      const intent = await provider.getUploadIntent('new-image.jpg');

      expect(intent.uploadUrl).toBe(mockUploadUrl);
      expect(intent.publicUrl).toBe('https://imagedelivery.net/test-account-hash/uploaded-image-id/public');
      expect(intent.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw UploadFailedProblem when API returns error', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Unauthorized',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getUploadIntent('new-image.jpg')).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw UploadFailedProblem when response success is false', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          errors: ['Invalid request'],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(provider.getUploadIntent('new-image.jpg')).rejects.toThrow(UploadFailedProblem);
    });

    it('should use custom domain for publicUrl when configured', async () => {
      const providerWithCustomDomain = new CloudflareImagesProvider(mockOptionsWithCustomDomain);
      const mockUploadUrl = 'https://upload.cloudflare.com/example';
      const mockImageId = 'uploaded-image-id';
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

      const intent = await providerWithCustomDomain.getUploadIntent('new-image.jpg');

      expect(intent.publicUrl).toContain('cdn.example.com');
    });

    it('should set correct expiration time (1 hour from now)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const mockUploadUrl = 'https://upload.cloudflare.com/example';
      const mockImageId = 'uploaded-image-id';
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

      const intent = await provider.getUploadIntent('new-image.jpg');
      const expectedExpires = new Date(now + 3600 * 1000);

      expect(intent.expiresAt.getTime()).toBeCloseTo(expectedExpires.getTime(), -3);

      vi.restoreAllMocks();
    });
  });
});
