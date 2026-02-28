import { Readable } from 'node:stream';
import type { ConfigService } from '@croco/framework-config';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { R2StorageProvider } from '../libs/R2StorageProvider';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mockSend;
  },
  GetObjectCommand: class {},
  PutObjectCommand: class {},
  DeleteObjectCommand: class {},
  HeadObjectCommand: class {},
}));

describe('R2StorageProvider', () => {
  let provider!: R2StorageProvider;
  let configService!: ConfigService;
  let logger!: import('@croco/framework-logger').Logger;

  beforeEach(() => {
    Container.reset();

    configService = {
      get: vi.fn((key: string) => {
        const envs: Record<string, string> = {
          R2_ACCOUNT_ID: 'test-account-id',
          R2_ACCESS_KEY_ID: 'test-access-key',
          R2_SECRET_ACCESS_KEY: 'test-secret-key',
          R2_BUCKET: 'test-bucket',
        };
        return envs[key];
      }),
    } as unknown as ConfigService;

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as import('@croco/framework-logger').Logger;

    provider = new R2StorageProvider(configService, logger);
  });

  describe('getPublicUrl', () => {
    it('should return default R2 public URL when publicUrlBase is not set', () => {
      const url = provider.getPublicUrl('test/file.txt');
      expect(url).toBe('https://test-bucket.test-account-id.r2.dev/test/file.txt');
    });

    it('should return custom public URL when publicUrlBase is set', () => {
      vi.mocked(configService.get).mockImplementation((key: string) => {
        if (key === 'R2_PUBLIC_URL_BASE') return 'https://cdn.example.com';
        if (key === 'R2_BUCKET') return 'test-bucket';
        return 'test-value';
      });

      const customProvider = new R2StorageProvider(configService, logger);
      const url = customProvider.getPublicUrl('test/file.txt');
      expect(url).toBe('https://cdn.example.com/test/file.txt');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL with expiration', async () => {
      vi.mock('@aws-sdk/s3-request-presigner', () => ({
        getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
      }));

      const url = await provider.getSignedUrl('test/file.txt', { expiresIn: 3600 });
      expect(url).toBe('https://signed-url.example.com');
    });
  });

  describe('getStream', () => {
    it('should return a readable stream from S3', async () => {
      const mockBody = Readable.from([Buffer.from('stream')]);
      mockSend.mockResolvedValue({
        Body: mockBody,
      });

      const stream = await provider.getStream('test/file.txt');
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
          continue;
        }

        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
          continue;
        }

        chunks.push(Buffer.from([Number(chunk)]));
      }

      expect(Buffer.concat(chunks)).toEqual(Buffer.from('stream'));
    });

    it('should throw FileNotFoundProblem when S3 returns 404', async () => {
      const mockError = {
        $metadata: { httpStatusCode: 404 },
        name: 'NotFound',
      };

      mockSend.mockRejectedValue(mockError);

      await expect(provider.getStream('test/file.txt')).rejects.toThrow();
    });

    it('should throw error when response body is empty', async () => {
      mockSend.mockResolvedValue({
        Body: undefined,
      });

      await expect(provider.getStream('test/file.txt')).rejects.toThrow('Empty response body');
    });
  });
});
