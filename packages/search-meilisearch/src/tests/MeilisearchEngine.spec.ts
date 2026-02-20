import { Context } from '@croco/framework-context';
import { MissingTenantProblem } from '@croco/search-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeilisearchEngine } from '../libs/MeilisearchEngine';
import type { MeilisearchEngineOptions } from '../libs/types';

const mocks = vi.hoisted(() => {
  const index = {
    search: vi.fn(),
    addDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    deleteDocuments: vi.fn(),
    updateSettings: vi.fn(),
    delete: vi.fn(),
  };
  const client = {
    index: vi.fn(() => index),
    createIndex: vi.fn(),
    deleteIndex: vi.fn(),
    generateTenantToken: vi.fn(),
  };
  return { clientMock: client, indexMock: index };
});

vi.mock('meilisearch', () => ({
  MeiliSearch: class {
    constructor() {
      Object.assign(this, mocks.clientMock);
    }
  },
}));

describe('MeilisearchEngine', () => {
  let engine: MeilisearchEngine;

  const options: MeilisearchEngineOptions = {
    host: 'http://localhost:7700',
    apiKey: 'masterKey',
    tenantTokenOptions: {
      apiKeyUid: 'uid',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default returns
    mocks.indexMock.search.mockResolvedValue({ hits: [], estimatedTotalHits: 0 });
    mocks.indexMock.addDocuments.mockResolvedValue({ taskUid: 1 });
    mocks.indexMock.deleteDocument.mockResolvedValue({ taskUid: 1 });
    mocks.indexMock.deleteDocuments.mockResolvedValue({ taskUid: 1 });
    mocks.indexMock.updateSettings.mockResolvedValue({ taskUid: 1 });

    mocks.clientMock.createIndex.mockResolvedValue({ taskUid: 1 });
    mocks.clientMock.deleteIndex.mockResolvedValue({ taskUid: 1 });
    mocks.clientMock.generateTenantToken.mockReturnValue('token');

    engine = new MeilisearchEngine(options);
  });

  describe('search', () => {
    it('should throw MissingTenantProblem if tenantId is missing', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue(null);
      await expect(engine.search('index', { query: 'test' })).rejects.toThrow(MissingTenantProblem);
    });

    it('should add tenant filter to search query', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue('tenant-1');
      await engine.search('index', { query: 'test' });

      expect(mocks.clientMock.index).toHaveBeenCalledWith('index');
      expect(mocks.indexMock.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          filter: expect.arrayContaining(['_tenantId = "tenant-1"']),
        })
      );
    });

    it('should combine with existing filters', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue('tenant-1');
      await engine.search('index', { query: 'test', filters: { status: 'active' } });

      expect(mocks.indexMock.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          filter: expect.arrayContaining(['_tenantId = "tenant-1"', 'status = "active"']),
        })
      );
    });
  });

  describe('indexDocument', () => {
    it('should throw MissingTenantProblem if tenantId is missing', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue(null);
      await expect(engine.indexDocument('index', { id: '1', tenantId: 'tenant-1' })).rejects.toThrow(
        MissingTenantProblem
      );
    });

    it('should add _tenantId field to document', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue('tenant-1');
      await engine.indexDocument('index', { id: '1', tenantId: 'tenant-1', title: 'test' });

      expect(mocks.indexMock.addDocuments).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', title: 'test', _tenantId: 'tenant-1' }),
      ]);
    });
  });

  describe('createIndex', () => {
    it('should create index and update settings with _tenantId filterable', async () => {
      await engine.createIndex({ name: 'new-index', filterableFields: ['category'] });

      expect(mocks.clientMock.createIndex).toHaveBeenCalledWith('new-index', { primaryKey: 'id' });
      expect(mocks.indexMock.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          filterableAttributes: expect.arrayContaining(['_tenantId', 'category']),
        })
      );
    });
  });

  describe('generateTenantToken', () => {
    it('should generate tenant token using SDK', async () => {
      const token = await engine.generateTenantToken('tenant-1');
      expect(mocks.clientMock.generateTenantToken).toHaveBeenCalledWith(
        options.tenantTokenOptions?.apiKeyUid,
        {
          '*': {
            filter: `_tenantId = "tenant-1"`,
          },
        },
        expect.anything()
      );
      expect(token).toBe('token');
    });

    it('should compute expiresAt when expiresIn is 0', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

      const engineWithZeroExpiresIn = new MeilisearchEngine({
        ...options,
        tenantTokenOptions: {
          apiKeyUid: 'uid',
          expiresIn: 0,
        },
      });

      await engineWithZeroExpiresIn.generateTenantToken('tenant-1');

      expect(mocks.clientMock.generateTenantToken).toHaveBeenCalledWith(
        'uid',
        {
          '*': {
            filter: `_tenantId = "tenant-1"`,
          },
        },
        {
          expiresAt: new Date(1_700_000_000_000),
        }
      );

      dateNowSpy.mockRestore();
    });
  });
});
