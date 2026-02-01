import type { ConfigService } from '@croco/framework-config';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { R2StorageProvider } from '../libs/R2StorageProvider';

describe('R2StorageProvider', () => {
  let provider!: R2StorageProvider;
  let configService!: ConfigService;

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

    provider = new R2StorageProvider(configService);
  });

  describe('getPublicUrl', () => {
    it('should return default R2 public URL when publicUrlBase is not set', () => {
      const url = provider.getPublicUrl('test/file.txt');
      expect(url).toBe('https://test-bucket.test-account-id.r2.dev/test/file.txt');
    });

    it('should return custom public URL when publicUrlBase is set', () => {
      (configService.get as any).mockImplementation((key: string) => {
        if (key === 'R2_PUBLIC_URL_BASE') return 'https://cdn.example.com';
        if (key === 'R2_BUCKET') return 'test-bucket';
        return 'test-value';
      });

      // Re-instantiate with updated config behavior
      const customProvider = new R2StorageProvider(configService);
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
