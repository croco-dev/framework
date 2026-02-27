import { Container } from '@croco/framework-context';
import type { ObjectMetadata, PutOptions, SignedUrlOptions, TransformOptions, UploadIntent } from '@croco/storage-core';
import { FileNotFoundProblem, InvalidKeyProblem, UploadFailedProblem } from '@croco/storage-core';
import { v2 as cloudinary } from 'cloudinary';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudinaryProvider } from '../libs/CloudinaryProvider';

type UploadStream = typeof cloudinary.uploader.upload_stream;

// Cloudinary SDK 모킹
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn(),
      destroy: vi.fn(),
    },
    api: {
      resource: vi.fn(),
    },
    url: vi.fn(() => 'https://res.cloudinary.com/test-cloud/image/upload/test-key'),
  },
}));

// fetch 모킹
global.fetch = vi.fn();

describe('CloudinaryProvider', () => {
  let provider!: CloudinaryProvider;

  const mockConfig = {
    cloudName: 'test-cloud',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    secure: true,
  };

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();

    provider = new CloudinaryProvider(mockConfig);
  });

  describe('put()', () => {
    it('should upload buffer data successfully', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      await expect(provider.put('test-key', buffer)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'auto',
        },
        expect.any(Function)
      );
    });

    it('should upload readable stream data successfully', async () => {
      const { PassThrough, Readable } = await import('node:stream');
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          const destination = new PassThrough();
          queueMicrotask(() => {
            callback(undefined, { public_id: 'test-key' });
          });
          return destination;
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const stream = Readable.from(Buffer.from('test data'));

      await expect(provider.put('test-key', stream)).resolves.not.toThrow();
    });

    it('should upload with content type option', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      const options: PutOptions = { contentType: 'image/jpeg' };

      await expect(provider.put('test-key', buffer, options)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'image',
        },
        expect.any(Function)
      );
    });

    it('should upload with metadata', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      const options: PutOptions = {
        metadata: { alt: 'test image', author: 'test' },
      };

      await expect(provider.put('test-key', buffer, options)).resolves.not.toThrow();

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'auto',
          context: 'alt=test image|author=test',
        },
        expect.any(Function)
      );
    });

    it('should throw UploadFailedProblem on upload error', async () => {
      const mockError = new Error('Upload failed');
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(mockError, undefined);
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');

      await expect(provider.put('test-key', buffer)).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw UploadFailedProblem when upload stream creation throws', async () => {
      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(() => {
        throw new Error('Cloudinary SDK error');
      });

      await expect(provider.put('test-key', Buffer.from('test data'))).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw UploadFailedProblem when source stream emits error', async () => {
      const { PassThrough } = await import('node:stream');
      const destination = new PassThrough();

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(
        () => destination as unknown as ReturnType<UploadStream>
      );

      const source = new PassThrough();
      const putPromise = provider.put('test-key', source);

      source.emit('error', new Error('Stream broken'));

      await expect(putPromise).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw InvalidKeyProblem for empty key', async () => {
      const buffer = Buffer.from('test data');

      await expect(provider.put('', buffer)).rejects.toThrow(InvalidKeyProblem);
    });

    it('should throw InvalidKeyProblem for key starting with /', async () => {
      const buffer = Buffer.from('test data');

      await expect(provider.put('/invalid-key', buffer)).rejects.toThrow(InvalidKeyProblem);
    });

    it('should throw InvalidKeyProblem for key ending with /', async () => {
      const buffer = Buffer.from('test data');

      await expect(provider.put('invalid-key/', buffer)).rejects.toThrow(InvalidKeyProblem);
    });

    it('should throw InvalidKeyProblem for key containing //', async () => {
      const buffer = Buffer.from('test data');

      await expect(provider.put('invalid//key', buffer)).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('get()', () => {
    it('should fetch resource successfully', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await provider.get('test-key');

      expect(result).toBeInstanceOf(Buffer);
      expect(global.fetch).toHaveBeenCalledWith('https://res.cloudinary.com/test-cloud/image/upload/test-key');
    });

    it('should throw FileNotFoundProblem on 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(provider.get('test-key')).rejects.toThrow(FileNotFoundProblem);
    });

    it('should throw UploadFailedProblem on non-404 HTTP error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(provider.get('test-key')).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw UploadFailedProblem on fetch error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      await expect(provider.get('test-key')).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw InvalidKeyProblem for invalid key', async () => {
      await expect(provider.get('')).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('getStream()', () => {
    it('should return readable stream', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const stream = await provider.getStream('test-key');

      expect(stream).not.toBeUndefined();
      expect(stream.pipe).not.toBeUndefined();
    });
  });

  describe('delete()', () => {
    it('should delete resource successfully', async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' });

      await expect(provider.delete('test-key')).resolves.not.toThrow();

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('test-key', {
        resource_type: 'image',
      });
    });

    it('should handle not found result gracefully', async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'not found' });

      await expect(provider.delete('test-key')).resolves.not.toThrow();
    });

    it('should throw UploadFailedProblem on delete failure', async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'error' });

      await expect(provider.delete('test-key')).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw InvalidKeyProblem for invalid key', async () => {
      await expect(provider.delete('')).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('exists()', () => {
    it('should return true for existing resource', async () => {
      vi.mocked(cloudinary.api.resource).mockResolvedValue({ public_id: 'test-key' });

      const result = await provider.exists('test-key');

      expect(result).toBe(true);
      expect(cloudinary.api.resource).toHaveBeenCalledWith('test-key', {
        resource_type: 'image',
      });
    });

    it('should return false for non-existing resource', async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue(new Error('Not found'));

      const result = await provider.exists('test-key');

      expect(result).toBe(false);
    });

    it('should throw InvalidKeyProblem for invalid key', async () => {
      await expect(provider.exists('')).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('getPublicUrl()', () => {
    it('should return public URL', () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/test-key');

      const url = provider.getPublicUrl('test-key');

      expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/test-key');
      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
      });
    });

    it('should return HTTP URL when secure is false', () => {
      const httpProvider = new CloudinaryProvider({ ...mockConfig, secure: false });
      vi.mocked(cloudinary.url).mockReturnValue('http://res.cloudinary.com/test-cloud/image/upload/test-key');

      httpProvider.getPublicUrl('test-key');

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: false,
      });
    });

    it('should throw InvalidKeyProblem for invalid key', () => {
      expect(() => provider.getPublicUrl('')).toThrow(InvalidKeyProblem);
    });
  });

  describe('getSignedUrl()', () => {
    it('should return signed URL with expiration', async () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/test-key?s=sig');

      const options: SignedUrlOptions = { expiresIn: 3600 };
      const url = await provider.getSignedUrl('test-key', options);

      expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/test-key?s=sig');

      const now = Date.now() / 1000;
      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        sign_url: true,
        expiration: Math.floor(now) + 3600,
      });
    });

    it('should throw InvalidKeyProblem for invalid key', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };

      await expect(provider.getSignedUrl('', options)).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('getMetadata()', () => {
    it('should return resource metadata', async () => {
      const mockResource = {
        bytes: 1024,
        format: 'jpg',
        created_at: '2024-01-01T00:00:00Z',
        etag: 'abc123',
        context: { custom: { alt: 'test', author: 'test' } },
      };

      vi.mocked(cloudinary.api.resource).mockResolvedValue(mockResource);

      const metadata = await provider.getMetadata('test-key');

      const expectedMetadata: ObjectMetadata = {
        size: 1024,
        contentType: 'jpg',
        lastModified: new Date('2024-01-01T00:00:00Z'),
        etag: 'abc123',
        metadata: { alt: 'test', author: 'test' },
      };

      expect(metadata).toEqual(expectedMetadata);
    });

    it('should handle missing optional metadata fields', async () => {
      const mockResource = {
        bytes: 0,
        format: 'png',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(cloudinary.api.resource).mockResolvedValue(mockResource);

      const metadata = await provider.getMetadata('test-key');

      expect(metadata.size).toBe(0);
      expect(metadata.etag).toBeUndefined();
      expect(metadata.metadata).toBeUndefined();
    });

    it('should throw FileNotFoundProblem on resource not found', async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue(new Error('Not found'));

      await expect(provider.getMetadata('test-key')).rejects.toThrow(FileNotFoundProblem);
    });

    it('should throw FileNotFoundProblem when Cloudinary returns 404 code', async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue({
        http_code: 404,
        message: 'Resource not found',
      });

      await expect(provider.getMetadata('test-key')).rejects.toThrow(FileNotFoundProblem);
    });

    it('should throw UploadFailedProblem for non-404 metadata errors', async () => {
      vi.mocked(cloudinary.api.resource).mockRejectedValue({
        http_code: 403,
        message: 'Forbidden',
      });

      await expect(provider.getMetadata('test-key')).rejects.toThrow(UploadFailedProblem);
    });

    it('should throw InvalidKeyProblem for invalid key', async () => {
      await expect(provider.getMetadata('')).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('getTransformUrl()', () => {
    it('should generate transform URL with width and height', () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        'https://res.cloudinary.com/test-cloud/image/upload/w_200,h_200/test-key'
      );

      const options: TransformOptions = { width: 200, height: 200 };
      const url = provider.getTransformUrl('test-key', options);

      expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/w_200,h_200/test-key');
      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'w_200,h_200',
      });
    });

    it('should generate transform URL with fit mode', () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/c_fill/test-key');

      const options: TransformOptions = { fit: 'cover' };
      provider.getTransformUrl('test-key', options);

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'c_fill',
      });
    });

    it('should generate transform URL with quality', () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/q_80/test-key');

      const options: TransformOptions = { quality: 80 };
      provider.getTransformUrl('test-key', options);

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'q_80',
      });
    });

    it('should generate transform URL with format', () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/f_webp/test-key');

      const options: TransformOptions = { format: 'webp' };
      provider.getTransformUrl('test-key', options);

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'f_webp',
      });
    });

    it('should ignore auto format', () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/test-key');

      const options: TransformOptions = { format: 'auto' };
      provider.getTransformUrl('test-key', options);

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: undefined,
      });
    });

    it('should generate transform URL with DPR', () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/dpr_2.0/test-key');

      const options: TransformOptions = { dpr: 2 };
      provider.getTransformUrl('test-key', options);

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'dpr_2',
      });
    });

    it('should generate transform URL with combined options', () => {
      vi.mocked(cloudinary.url).mockReturnValue(
        'https://res.cloudinary.com/test-cloud/image/upload/w_200,h_200,c_fill,q_80/test-key'
      );

      const options: TransformOptions = {
        width: 200,
        height: 200,
        fit: 'cover',
        quality: 80,
      };
      provider.getTransformUrl('test-key', options);

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'w_200,h_200,c_fill,q_80',
      });
    });

    it('should throw InvalidKeyProblem for invalid key', () => {
      const options: TransformOptions = { width: 200 };

      expect(() => provider.getTransformUrl('', options)).toThrow(InvalidKeyProblem);
    });
  });

  describe('getUploadIntent()', () => {
    it('should return upload intent with URLs and expiration', async () => {
      vi.mocked(cloudinary.url).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/test-key');

      const intent = await provider.getUploadIntent('test-key');

      const expectedIntent: UploadIntent = {
        uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
        publicUrl: 'https://res.cloudinary.com/test-cloud/image/upload/test-key',
        expiresAt: expect.any(Date),
      };

      expect(intent).toEqual(expectedIntent);
      expect(intent.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(intent.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3600 * 1000);
    });

    it('should throw InvalidKeyProblem for invalid key', async () => {
      await expect(provider.getUploadIntent('')).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe('fit mode mapping', () => {
    it('should map cover to fill', () => {
      vi.mocked(cloudinary.url).mockReturnValue('');

      provider.getTransformUrl('test-key', { fit: 'cover' });

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'c_fill',
      });
    });

    it('should map contain to fit', () => {
      vi.mocked(cloudinary.url).mockReturnValue('');

      provider.getTransformUrl('test-key', { fit: 'contain' });

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'c_fit',
      });
    });

    it('should map fill to pad', () => {
      vi.mocked(cloudinary.url).mockReturnValue('');

      provider.getTransformUrl('test-key', { fit: 'fill' });

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'c_pad',
      });
    });

    it('should map inside to limit', () => {
      vi.mocked(cloudinary.url).mockReturnValue('');

      provider.getTransformUrl('test-key', { fit: 'inside' });

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'c_limit',
      });
    });

    it('should map outside to crop', () => {
      vi.mocked(cloudinary.url).mockReturnValue('');

      provider.getTransformUrl('test-key', { fit: 'outside' });

      expect(cloudinary.url).toHaveBeenCalledWith('test-key', {
        secure: true,
        transformation: 'c_crop',
      });
    });
  });

  describe('resource type inference', () => {
    it('should infer image type from content type', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      await provider.put('test-key', buffer, { contentType: 'image/png' });

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'image',
        },
        expect.any(Function)
      );
    });

    it('should infer video type from content type', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      await provider.put('test-key', buffer, { contentType: 'video/mp4' });

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'video',
        },
        expect.any(Function)
      );
    });

    it('should infer raw type for other content types', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      await provider.put('test-key', buffer, { contentType: 'application/pdf' });

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'raw',
        },
        expect.any(Function)
      );
    });

    it('should use auto when content type is not provided', async () => {
      const mockUploadStream = vi.fn(
        (_options: unknown, callback: (error: Error | undefined, result: unknown) => void) => {
          callback(undefined, { public_id: 'test-key' });
          return {
            end: vi.fn(),
          };
        }
      );

      vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(mockUploadStream as unknown as UploadStream);

      const buffer = Buffer.from('test data');
      await provider.put('test-key', buffer);

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        {
          public_id: 'test-key',
          resource_type: 'auto',
        },
        expect.any(Function)
      );
    });
  });
});
