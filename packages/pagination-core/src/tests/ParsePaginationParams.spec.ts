import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMIT } from '../libs/constants';
import { parsePaginationParams } from '../libs/parsePaginationParams';
import { ConflictingPaginationProblem } from '../libs/problems';

describe('parsePaginationParams', () => {
  it('should parse cursor mode params', () => {
    const result = parsePaginationParams({ cursor: 'abc123', limit: '10' });
    expect(result.mode).toBe('cursor');
    if (result.mode === 'cursor') {
      expect(result.cursor).toBe('abc123');
      expect(result.limit).toBe(10);
    }
  });

  it('should parse offset mode params', () => {
    const result = parsePaginationParams({ offset: '20', limit: '10' });
    expect(result.mode).toBe('offset');
    if (result.mode === 'offset') {
      expect(result.offset).toBe(20);
      expect(result.limit).toBe(10);
    }
  });

  it('should default to cursor mode with default limit when empty', () => {
    const result = parsePaginationParams({});
    expect(result.mode).toBe('cursor');
    if (result.mode === 'cursor') {
      expect(result.cursor).toBeUndefined();
      expect(result.limit).toBe(DEFAULT_LIMIT);
    }
  });

  it('should clamp limit to MAX_LIMIT (100)', () => {
    const result = parsePaginationParams({ limit: '200' });
    expect(result.limit).toBe(100);
  });

  it('should use DEFAULT_LIMIT when limit is 0', () => {
    const result = parsePaginationParams({ limit: '0' });
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it('should use DEFAULT_LIMIT when limit is negative', () => {
    const result = parsePaginationParams({ limit: '-5' });
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it('should use DEFAULT_LIMIT when limit is NaN', () => {
    const result = parsePaginationParams({ limit: 'abc' });
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it('should floor limit when decimal', () => {
    const result = parsePaginationParams({ limit: '10.7' });
    expect(result.limit).toBe(10);
  });

  it('should clamp offset to MIN_OFFSET (0) when negative', () => {
    const result = parsePaginationParams({ offset: '-3' });
    if (result.mode === 'offset') {
      expect(result.offset).toBe(0);
    }
  });

  it('should use MIN_OFFSET when offset is NaN', () => {
    const result = parsePaginationParams({ offset: 'xyz' });
    if (result.mode === 'offset') {
      expect(result.offset).toBe(0);
    }
  });

  it('should throw ConflictingPaginationProblem when both cursor and offset provided', () => {
    expect(() => parsePaginationParams({ cursor: 'abc', offset: '10' })).toThrow(ConflictingPaginationProblem);
  });

  it('should throw ConflictingPaginationProblem even with limit provided', () => {
    expect(() => parsePaginationParams({ cursor: 'abc', offset: '10', limit: '5' })).toThrow(
      ConflictingPaginationProblem
    );
  });
});
