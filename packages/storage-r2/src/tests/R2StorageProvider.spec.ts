import { Readable } from 'node:stream';
import type { ConfigService } from '@croco/framework-config';
import { Container } from '@croco/framework-context';
import type { Logger } from '@croco/framework-logger';
import { FileNotFoundProblem } from '@croco/storage-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyR2BodyProblem } from '../libs/problems/EmptyR2BodyProblem';
import { MissingR2ConfigProblem } from '../libs/problems/MissingR2ConfigProblem';
import { R2ObjectTooLargeProblem } from '../libs/problems/R2ObjectTooLargeProblem';
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

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
}));

describe('R2StorageProvider', () => {
  let provider!: R2StorageProvider;
  let configService!: ConfigService;
  let logger!: Logger;

  const defaultEnvs: Record<string, string> = {
    R2_ACCOUNT_ID: 'test-account-id',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET: 'test-bucket',
  };

  beforeEach(() => {
    Container.reset();
    mockSend.mockReset();

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

  describe('constructor', () => {
    it.each([
      ['R2_ACCOUNT_ID'],
      ['R2_ACCESS_KEY_ID'],
      ['R2_SECRET_ACCESS_KEY'],
      ['R2_BUCKET'],
    ])('should throw MissingR2ConfigProblem when %s is missing', (missingKey) => {
      vi.mocked(configService.get).mockImplementation((key: string) => {
        if (key === missingKey) {
          return undefined;
        }

        return defaultEnvs[key];
      });

      expect(() => new R2StorageProvider(configService, logger)).toThrow(MissingR2ConfigProblem);
      expect(() => new R2StorageProvider(configService, logger)).toThrow(
        `Missing required R2 configuration: ${missingKey}`
      );
    });
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
      mockSend.mockRejectedValue({
        $metadata: { httpStatusCode: 404 },
        name: 'NotFound',
      });

      await expect(provider.getStream('test/file.txt')).rejects.toThrow(FileNotFoundProblem);
    });

    it('should throw error when response body is empty', async () => {
      mockSend.mockResolvedValue({
        Body: undefined,
      });

      const streamPromise = provider.getStream('test/file.txt');

      await expect(streamPromise).rejects.toBeInstanceOf(EmptyR2BodyProblem);
      await expect(streamPromise).rejects.toThrow('Empty response body');
    });
  });

  describe('get', () => {
    it('should buffer a small object into a Buffer', async () => {
      mockSend.mockResolvedValue({
        Body: Readable.from([Buffer.from('hello '), Buffer.from('world')]),
      });

      const buffer = await provider.get('test/file.txt');

      expect(buffer).toEqual(Buffer.from('hello world'));
    });

    it('should throw R2ObjectTooLargeProblem when buffered bytes exceed the limit', async () => {
      const oversizedChunk = Buffer.alloc(6 * 1024 * 1024, 'a');
      mockSend.mockResolvedValue({
        Body: Readable.from([oversizedChunk, oversizedChunk]),
      });

      const getPromise = provider.get('test/file.txt');

      await expect(getPromise).rejects.toThrow(R2ObjectTooLargeProblem);
      await expect(getPromise).rejects.toThrow(
        "R2 object 'test/file.txt' exceeds the in-memory download limit of 10485760 bytes"
      );
    });
  });
});
