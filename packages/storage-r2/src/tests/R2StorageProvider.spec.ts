import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { R2StorageProvider } from '../libs/R2StorageProvider';

describe('R2StorageProvider', () => {
  let provider!: R2StorageProvider;

  beforeEach(() => {
    Container.reset();

    process.env.R2_ACCOUNT_ID = 'test-account-id';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET = 'test-bucket';

    provider = new R2StorageProvider();
  });

  describe('getPublicUrl', () => {
    it('should return default R2 public URL when publicUrlBase is not set', () => {
      const url = provider.getPublicUrl('test/file.txt');
      expect(url).toBe('https://test-bucket.test-account-id.r2.dev/test/file.txt');
    });

    it('should return custom public URL when publicUrlBase is set', () => {
      process.env.R2_PUBLIC_URL_BASE = 'https://cdn.example.com';
      const customProvider = new R2StorageProvider();
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
});
