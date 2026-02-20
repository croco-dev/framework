import { Container, Context } from '@croco/framework-context';
import { StrategyUnavailableProblem } from '@croco/search-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleSearchEngine } from '../libs/DrizzleSearchEngine';
import type { SearchStrategy } from '../libs/types';

// Mock external dependencies
vi.mock('@croco/framework-context', async () => {
  const actual = await vi.importActual('@croco/framework-context');
  return {
    ...actual,
    Context: {
      getTenantId: vi.fn(),
    },
  };
});

// Mock Strategy
const mockStrategy = {
  buildSearchQuery: vi.fn(),
  buildIndexQuery: vi.fn(),
  buildDeleteQuery: vi.fn(),
  getRequiredExtensions: vi.fn(),
  checkCapability: vi.fn(),
  getCapabilities: vi.fn(),
} as unknown as SearchStrategy;

// Mock DB
const mockDb = {
  execute: vi.fn(),
} as any;

describe('DrizzleSearchEngine', () => {
  let engine: DrizzleSearchEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    Container.reset();

    // Default setups
    (Context.getTenantId as any).mockReturnValue('tenant-123');
    (mockStrategy.checkCapability as any).mockResolvedValue(true);
    (mockStrategy.getCapabilities as any).mockReturnValue({
      fullText: true,
      fuzzy: false,
      highlight: false,
    });

    // Mock SQL return
    const mockSql = { toSQL: () => ({ sql: 'SELECT 1', params: [] }) };
    (mockStrategy.buildSearchQuery as any).mockReturnValue(mockSql);
    (mockStrategy.buildIndexQuery as any).mockReturnValue(mockSql);
    (mockStrategy.buildDeleteQuery as any).mockReturnValue(mockSql);

    (mockDb.execute as any).mockResolvedValue({ rows: [] });
  });

  it('should initialize and pass capability check', async () => {
    engine = new DrizzleSearchEngine(mockDb, mockStrategy);

    // Since check is async, we verify it eventually called
    expect(mockStrategy.checkCapability).toHaveBeenCalledWith(mockDb);
  });

  it('should throw StrategyUnavailableProblem if capability check fails', async () => {
    (mockStrategy.checkCapability as any).mockResolvedValue(false);
    engine = new DrizzleSearchEngine(mockDb, mockStrategy);

    await expect(engine.search('users', { query: 'test' })).rejects.toThrow(StrategyUnavailableProblem);
  });

  it('should use tenantId from Context in search', async () => {
    engine = new DrizzleSearchEngine(mockDb, mockStrategy);

    await engine.search('users', { query: 'test' });

    expect(Context.getTenantId).toHaveBeenCalled();
    expect(mockStrategy.buildSearchQuery).toHaveBeenCalledWith('users', { query: 'test' }, 'tenant-123');
  });

  it('should preserve zero score from search result', async () => {
    (mockDb.execute as any).mockResolvedValueOnce({
      rows: [{ id: 'doc-1', score: 0 }],
      rowCount: 1,
    });

    engine = new DrizzleSearchEngine(mockDb, mockStrategy);
    const result = await engine.search<{ id: string; score: number }>('users', { query: 'test' });

    expect(result.hits[0]?.score).toBe(0);
  });

  it('should delegate indexDocument to strategy', async () => {
    engine = new DrizzleSearchEngine(mockDb, mockStrategy);
    const doc = { id: '1', tenantId: 'tenant-123', title: 'hello' };

    await engine.indexDocument('users', doc);

    expect(mockStrategy.buildIndexQuery).toHaveBeenCalledWith('users', doc, 'tenant-123');
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('should delegate deleteDocument to strategy', async () => {
    engine = new DrizzleSearchEngine(mockDb, mockStrategy);

    await engine.deleteDocument('users', '1');

    expect(mockStrategy.buildDeleteQuery).toHaveBeenCalledWith('users', '1', 'tenant-123');
    expect(mockDb.execute).toHaveBeenCalled();
  });
});
