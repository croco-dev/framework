import { Context } from '@croco/framework-context';
import { describe, expect, it, vi } from 'vitest';
import { BatchLoad } from '../libs/decorators/BatchLoad';

// Mock class for testing
class TestRepository {
  // Method to be mocked
  findByIds = vi.fn();

  @BatchLoad({ by: 'id' })
  async findById(id: string) {
    return this.originalFindById(id);
  }

  // Helper to mock original behavior if needed, though usually shadowed by batchFn
  async originalFindById(id: string) {
    return { id, value: `value-${id}` };
  }
}

class FallbackRepository {
  // No findByIds method

  callCount = 0;

  @BatchLoad({ by: 'id' })
  async findById(id: string) {
    this.callCount++;
    return { id, value: `value-${id}` };
  }
}

describe('BatchLoad Decorator', () => {
  it('should batch multiple calls into a single findByIds call', async () => {
    await Context.run({ requestId: 'test-1' }, async () => {
      const repository = new TestRepository();

      // Setup findByIds mock implementation
      repository.findByIds.mockImplementation(async (ids: string[]) => {
        return ids.map((id) => ({ id, value: `value-${id}` }));
      });

      // Execute parallel calls
      const p1 = repository.findById('1');
      const p2 = repository.findById('2');
      const p3 = repository.findById('1'); // Duplicate key

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      // Verify results
      expect(r1).toEqual({ id: '1', value: 'value-1' });
      expect(r2).toEqual({ id: '2', value: 'value-2' });
      expect(r3).toEqual({ id: '1', value: 'value-1' });

      // Verify batching behavior
      // Should be called once with unique keys ['1', '2']
      expect(repository.findByIds).toHaveBeenCalledTimes(1);
      const calledIds = repository.findByIds.mock.calls[0][0];
      expect(calledIds).toHaveLength(2);
      expect(calledIds).toContain('1');
      expect(calledIds).toContain('2');
    });
  });

  it('should fallback to parallel calls if findByIds is missing', async () => {
    await Context.run({ requestId: 'test-2' }, async () => {
      const fallbackRepo = new FallbackRepository();

      const p1 = fallbackRepo.findById('A');
      const p2 = fallbackRepo.findById('B');

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toEqual({ id: 'A', value: 'value-A' });
      expect(r2).toEqual({ id: 'B', value: 'value-B' });

      // Since findByIds is missing, it calls the original method 2 times
      // BUT internally it uses DataLoader, so the decorator overhead exists but logic works
      expect(fallbackRepo.callCount).toBe(2);
    });
  });

  it('should handle findByIds returning results in different order', async () => {
    await Context.run({ requestId: 'test-3' }, async () => {
      const repository = new TestRepository();

      // Setup findByIds to return in reverse order
      repository.findByIds.mockImplementation(async (ids: string[]) => {
        return [
          { id: '2', value: 'value-2' },
          { id: '1', value: 'value-1' },
        ];
      });

      const p1 = repository.findById('1');
      const p2 = repository.findById('2');

      const [r1, r2] = await Promise.all([p1, p2]);

      // Loader should reorder correctly based on 'by: id'
      expect(r1).toEqual({ id: '1', value: 'value-1' });
      expect(r2).toEqual({ id: '2', value: 'value-2' });
    });
  });

  it('should propagate errors from findByIds', async () => {
    await Context.run({ requestId: 'test-4' }, async () => {
      const repository = new TestRepository();

      const error = new Error('DB Error');
      repository.findByIds.mockRejectedValue(error);

      const p1 = repository.findById('1');
      const p2 = repository.findById('2');

      await expect(p1).rejects.toThrow('DB Error');
      await expect(p2).rejects.toThrow('DB Error');
    });
  });
});
