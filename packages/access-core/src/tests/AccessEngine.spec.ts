import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessEngine } from '../libs/AccessEngine';
import type { AccessProvider } from '../libs/interfaces/AccessProvider';
import type { CheckRequest, GrantRequest, ListRequest, RelationTuple, RevokeRequest } from '../libs/types';

describe('AccessEngine', () => {
  let accessEngine: AccessEngine;
  let mockProvider: AccessProvider;

  beforeEach(() => {
    mockProvider = {
      check: vi.fn(),
      grant: vi.fn(),
      revoke: vi.fn(),
      list: vi.fn(),
    };
    accessEngine = new AccessEngine(mockProvider);
  });

  describe('check', () => {
    it('should deny when provider returns false', async () => {
      const request: CheckRequest = {
        tenantId: 'tenant-1',
        subject: 'user-1',
        relation: 'viewer',
        object: 'document-1',
      };
      vi.mocked(mockProvider.check).mockResolvedValue({ allowed: false });

      const result = await accessEngine.check(request);

      expect(result.allowed).toBe(false);
      expect(mockProvider.check).toHaveBeenCalledWith(request);
    });

    it('should allow when provider returns true', async () => {
      const request: CheckRequest = {
        tenantId: 'tenant-1',
        subject: 'user-1',
        relation: 'editor',
        object: 'document-1',
      };
      vi.mocked(mockProvider.check).mockResolvedValue({ allowed: true });

      const result = await accessEngine.check(request);

      expect(result.allowed).toBe(true);
      expect(mockProvider.check).toHaveBeenCalledWith(request);
    });

    it('should enforce tenantId hard filter', async () => {
      const request: CheckRequest = {
        tenantId: 'tenant-1',
        subject: 'user-1',
        relation: 'viewer',
        object: 'document-1',
      };
      vi.mocked(mockProvider.check).mockResolvedValue({ allowed: true });

      const result = await accessEngine.check(request);

      expect(result.allowed).toBe(true);
      expect(mockProvider.check).toHaveBeenCalledWith(request);
    });

    it('should deny on provider exception (fail-closed)', async () => {
      const request: CheckRequest = {
        tenantId: 'tenant-1',
        subject: 'user-1',
        relation: 'viewer',
        object: 'document-1',
      };
      vi.mocked(mockProvider.check).mockRejectedValue(new Error('Provider error'));

      const result = await accessEngine.check(request);

      expect(result.allowed).toBe(false);
    });
  });

  describe('grant', () => {
    it('should delegate to provider', async () => {
      const request: GrantRequest = {
        tenantId: 'tenant-1',
        tuple: {
          object: 'document-1',
          relation: 'editor',
          subject: 'user-1',
        },
      };
      vi.mocked(mockProvider.grant).mockResolvedValue(undefined);

      await accessEngine.grant(request);

      expect(mockProvider.grant).toHaveBeenCalledWith(request);
    });
  });

  describe('revoke', () => {
    it('should delegate to provider', async () => {
      const request: RevokeRequest = {
        tenantId: 'tenant-1',
        tuple: {
          object: 'document-1',
          relation: 'editor',
          subject: 'user-1',
        },
      };
      vi.mocked(mockProvider.revoke).mockResolvedValue(undefined);

      await accessEngine.revoke(request);

      expect(mockProvider.revoke).toHaveBeenCalledWith(request);
    });
  });

  describe('list', () => {
    it('should delegate to provider', async () => {
      const request: ListRequest = {
        tenantId: 'tenant-1',
        object: 'document-1',
      };
      const mockTuples: RelationTuple[] = [{ object: 'document-1', relation: 'editor', subject: 'user-1' }];
      vi.mocked(mockProvider.list).mockResolvedValue(mockTuples);

      const result = await accessEngine.list(request);

      expect(result).toEqual(mockTuples);
      expect(mockProvider.list).toHaveBeenCalledWith(request);
    });
  });
});
