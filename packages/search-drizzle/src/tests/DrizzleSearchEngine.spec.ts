import { Container, Context } from '@croco/framework-context';
import { SearchCapabilityUnavailableProblem, StrategyUnavailableProblem } from '@croco/search-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { DrizzleSearchEngine } from '../libs/DrizzleSearchEngine';
import { InvalidSearchRowProblem } from '../libs/problems/InvalidSearchRowProblem';
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
  mapSearchRow: vi.fn(),
};

const strategy = mockStrategy as unknown as SearchStrategy;

const executeMock = vi.fn();

// Mock DB
const mockDb = {
  execute: executeMock,
} as unknown as NodePgDatabase<Record<string, never>>;

describe('DrizzleSearchEngine', () => {
  let engine!: DrizzleSearchEngine;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    Container.reset();

    // Default setups
    (Context.getTenantId as Mock).mockReturnValue('tenant-123');
    mockStrategy.checkCapability.mockResolvedValue(true);
    mockStrategy.getCapabilities.mockReturnValue({
      fullText: true,
      fuzzy: false,
      highlight: false,
    });
    mockStrategy.mapSearchRow.mockReset();

    // Mock SQL return
    const mockSql = { toSQL: () => ({ sql: 'SELECT 1', params: [] }) };
    mockStrategy.buildSearchQuery.mockReturnValue(mockSql);
    mockStrategy.buildIndexQuery.mockReturnValue(mockSql);
    mockStrategy.buildDeleteQuery.mockReturnValue(mockSql);

    executeMock.mockResolvedValue({ rows: [] });
  });

  it('should check capability on first use', async () => {
    engine = new DrizzleSearchEngine(mockDb, strategy);

    await engine.search('users', { query: 'test' });

    expect(mockStrategy.checkCapability).toHaveBeenCalledWith(mockDb);
  });

  it('should throw StrategyUnavailableProblem if capability check fails', async () => {
    mockStrategy.checkCapability.mockResolvedValue(false);
    engine = new DrizzleSearchEngine(mockDb, strategy);

    await expect(engine.search('users', { query: 'test' })).rejects.toThrow(StrategyUnavailableProblem);
  });

  it('should retry capability checks after a transient failure', async () => {
    mockStrategy.checkCapability.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    engine = new DrizzleSearchEngine(mockDb, strategy);

    await expect(engine.search('users', { query: 'test' })).rejects.toThrow(StrategyUnavailableProblem);

    await expect(engine.search('users', { query: 'test' })).resolves.toEqual({
      hits: [],
      total: 0,
      query: { query: 'test' },
      processingTimeMs: 0,
    });

    expect(mockStrategy.checkCapability).toHaveBeenCalledTimes(2);
  });

  it('should use tenantId from Context in search', async () => {
    engine = new DrizzleSearchEngine(mockDb, strategy);

    await engine.search('users', { query: 'test' });

    expect(Context.getTenantId).toHaveBeenCalled();
    expect(mockStrategy.buildSearchQuery).toHaveBeenCalledWith('users', { query: 'test' }, 'tenant-123');
  });

  it('should preserve zero score from search result', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [{ id: 'doc-1', score: 0 }],
      rowCount: 1,
    });

    engine = new DrizzleSearchEngine(mockDb, strategy);
    const result = await engine.search<{ id: string; score: number }>('users', { query: 'test' });

    expect(result.hits[0]?.score).toBe(0);
  });

  it('should throw when search returns non-object rows', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [null],
      rowCount: 1,
    });

    engine = new DrizzleSearchEngine(mockDb, strategy);

    const searchPromise = engine.search('users', { query: 'test' });

    await expect(searchPromise).rejects.toBeInstanceOf(InvalidSearchRowProblem);
    await expect(searchPromise).rejects.toThrow('Invalid search row: expected object result');
  });

  it('should map search rows through strategy mapper when provided', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [{ id: 'doc-1', title: 'raw title', score: 0.8 }],
      rowCount: 1,
    });

    mockStrategy.mapSearchRow = vi.fn().mockImplementation((row) => ({
      id: row.id,
      title: String(row.title).toUpperCase(),
    }));

    engine = new DrizzleSearchEngine(mockDb, strategy);
    const result = await engine.search<{ id: string; title: string }>('users', { query: 'test' });

    expect(mockStrategy.mapSearchRow).toHaveBeenCalledWith({ id: 'doc-1', title: 'raw title', score: 0.8 });
    expect(result.hits[0]?.document).toEqual({ id: 'doc-1', title: 'RAW TITLE' });
    expect(result.hits[0]?.score).toBe(0.8);
  });

  it('should delegate indexDocument to strategy', async () => {
    engine = new DrizzleSearchEngine(mockDb, strategy);
    const doc = { id: '1', tenantId: 'tenant-123', title: 'hello' };

    await engine.indexDocument('users', doc);

    expect(mockStrategy.buildIndexQuery).toHaveBeenCalledWith('users', doc, 'tenant-123');
    expect(executeMock).toHaveBeenCalled();
  });

  it('should delegate deleteDocument to strategy', async () => {
    engine = new DrizzleSearchEngine(mockDb, strategy);

    await engine.deleteDocument('users', '1');

    expect(mockStrategy.buildDeleteQuery).toHaveBeenCalledWith('users', '1', 'tenant-123');
    expect(executeMock).toHaveBeenCalled();
  });

  it('should fail fast for unsupported createIndex capability', async () => {
    engine = new DrizzleSearchEngine(mockDb, strategy);

    await expect(
      engine.createIndex({
        name: 'users',
      })
    ).rejects.toBeInstanceOf(SearchCapabilityUnavailableProblem);
  });

  it('should fail fast for unsupported deleteIndex capability', async () => {
    engine = new DrizzleSearchEngine(mockDb, strategy);

    await expect(engine.deleteIndex('users')).rejects.toBeInstanceOf(SearchCapabilityUnavailableProblem);
  });
});
