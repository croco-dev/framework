import { describe, expect, it } from 'vitest';
import { createOffsetPage } from '../libs/createOffsetPage';

describe('createOffsetPage', () => {
  it('should return correct offset page structure', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const result = createOffsetPage(items, { total: 100, limit: 20, offset: 0 });
    expect(result.data).toEqual(items);
    expect(result.total).toBe(100);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should return empty data with total 0', () => {
    const result = createOffsetPage([], { total: 0, limit: 20, offset: 0 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should indicate last page when offset + data.length >= total', () => {
    const items = [{ id: '91' }, { id: '92' }];
    const result = createOffsetPage(items, { total: 92, limit: 20, offset: 90 });
    expect(result.data).toHaveLength(2);
    expect(result.offset + result.data.length).toBe(92);
  });
});
