import { describe, expect, it } from 'vitest';
import { SearchEngine } from '../libs/SearchEngine';

describe('SearchEngine', () => {
  describe('Token', () => {
    it('should have a static Token property', () => {
      expect(SearchEngine.token).toBeDefined();
      expect(SearchEngine.token.constructor.name).toBe('Token');
    });
  });

  describe('abstract methods', () => {
    class MockSearchEngine extends SearchEngine {
      capabilities = {
        facetedSearch: false,
        vectorSearch: false,
        highlightSearch: false,
        fuzzySearch: true,
      };

      async search<T>(_index: string, _query: unknown) {
        return {
          hits: [] as T[],
          total: 0,
          query: {} as any,
          processingTimeMs: 0,
        };
      }

      async indexDocument() {
        return;
      }

      async deleteDocument() {
        return;
      }

      async bulkIndex() {
        return;
      }

      async createIndex() {
        return;
      }

      async deleteIndex() {
        return;
      }
    }

    it('should require capabilities property', () => {
      const engine = new MockSearchEngine();
      expect(engine.capabilities).toBeDefined();
      expect(typeof engine.capabilities.facetedSearch).toBe('boolean');
      expect(typeof engine.capabilities.vectorSearch).toBe('boolean');
      expect(typeof engine.capabilities.highlightSearch).toBe('boolean');
      expect(typeof engine.capabilities.fuzzySearch).toBe('boolean');
    });

    it('should require search method', () => {
      const engine = new MockSearchEngine();
      expect(typeof engine.search).toBe('function');
    });

    it('should require indexDocument method', () => {
      const engine = new MockSearchEngine();
      expect(typeof engine.indexDocument).toBe('function');
    });

    it('should require deleteDocument method', () => {
      const engine = new MockSearchEngine();
      expect(typeof engine.deleteDocument).toBe('function');
    });

    it('should require bulkIndex method', () => {
      const engine = new MockSearchEngine();
      expect(typeof engine.bulkIndex).toBe('function');
    });

    it('should require createIndex method', () => {
      const engine = new MockSearchEngine();
      expect(typeof engine.createIndex).toBe('function');
    });

    it('should require deleteIndex method', () => {
      const engine = new MockSearchEngine();
      expect(typeof engine.deleteIndex).toBe('function');
    });
  });
});
