import { Context } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MissingTenantProblem } from '../libs/problems/SearchProblems';
import type { SearchEngine } from '../libs/SearchEngine';
import { SearchService } from '../libs/SearchService';
import type { SearchDocument, SearchQuery, SearchResult } from '../libs/types';

describe('SearchService', () => {
  let mockEngine: SearchEngine;
  let searchService: SearchService;

  beforeEach(() => {
    // Mock SearchEngine 구현
    mockEngine = {
      capabilities: {
        facetedSearch: false,
        vectorSearch: false,
        highlightSearch: false,
        fuzzySearch: true,
      },
      search: vi.fn(),
      indexDocument: vi.fn(),
      deleteDocument: vi.fn(),
      bulkIndex: vi.fn(),
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
    } as unknown as SearchEngine;

    searchService = new SearchService({ engine: mockEngine });
  });

  describe('search', () => {
    it('should throw error when tenantId is missing', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue(null);

      await expect(searchService.search('test-index', { query: 'test' })).rejects.toThrow(MissingTenantProblem);
    });

    it('should add tenantId filter and call engine.search when tenantId exists', async () => {
      const tenantId = 'tenant-123';
      vi.spyOn(Context, 'getTenantId').mockReturnValue(tenantId);

      const query: SearchQuery = { query: 'test', filters: { status: 'active' } };
      const expectedQuery: SearchQuery = { query: 'test', filters: { status: 'active', tenantId } };
      const mockResult: SearchResult<unknown> = {
        hits: [],
        total: 0,
        query: expectedQuery,
        processingTimeMs: 10,
      };
      vi.mocked(mockEngine.search).mockResolvedValue(mockResult);

      const result = await searchService.search('test-index', query);

      expect(mockEngine.search).toHaveBeenCalledWith('test-index', expectedQuery);
      expect(result).toEqual(mockResult);
    });
  });

  describe('indexDocument', () => {
    it('should throw error when tenantId is missing', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue(null);

      await expect(searchService.indexDocument('test-index', { id: 'doc-1', data: 'test' })).rejects.toThrow(
        MissingTenantProblem
      );
    });

    it('should add tenantId and call engine.indexDocument when tenantId exists', async () => {
      const tenantId = 'tenant-123';
      vi.spyOn(Context, 'getTenantId').mockReturnValue(tenantId);

      const document = { id: 'doc-1', data: 'test' };
      vi.mocked(mockEngine.indexDocument).mockResolvedValue(undefined);

      await searchService.indexDocument('test-index', document);

      const expectedDoc: SearchDocument = { ...document, tenantId };
      expect(mockEngine.indexDocument).toHaveBeenCalledWith('test-index', expectedDoc);
    });
  });

  describe('deleteDocument', () => {
    it('should throw error when tenantId is missing', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue(null);

      await expect(searchService.deleteDocument('test-index', 'doc-1')).rejects.toThrow(MissingTenantProblem);
    });

    it('should call engine.deleteDocument when tenantId exists', async () => {
      const tenantId = 'tenant-123';
      vi.spyOn(Context, 'getTenantId').mockReturnValue(tenantId);

      vi.mocked(mockEngine.deleteDocument).mockResolvedValue(undefined);

      await searchService.deleteDocument('test-index', 'doc-1');

      expect(mockEngine.deleteDocument).toHaveBeenCalledWith('test-index', 'doc-1');
    });
  });

  describe('bulkIndex', () => {
    it('should throw error when tenantId is missing', async () => {
      vi.spyOn(Context, 'getTenantId').mockReturnValue(null);

      await expect(searchService.bulkIndex('test-index', [{ id: 'doc-1', data: 'test' }])).rejects.toThrow(
        MissingTenantProblem
      );
    });

    it('should add tenantId to all documents and call engine.bulkIndex when tenantId exists', async () => {
      const tenantId = 'tenant-123';
      vi.spyOn(Context, 'getTenantId').mockReturnValue(tenantId);

      const documents = [
        { id: 'doc-1', data: 'test1' },
        { id: 'doc-2', data: 'test2' },
      ];
      vi.mocked(mockEngine.bulkIndex).mockResolvedValue(undefined);

      await searchService.bulkIndex('test-index', documents);

      const expectedDocs: SearchDocument[] = documents.map((doc) => ({ ...doc, tenantId }));
      expect(mockEngine.bulkIndex).toHaveBeenCalledWith('test-index', expectedDocs);
    });
  });
});
