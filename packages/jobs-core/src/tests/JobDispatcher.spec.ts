import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryJobStore } from '../libs/InMemoryJobStore';
import { JobDispatcher } from '../libs/JobDispatcher';
import type { JobStore } from '../libs/JobStore';

describe('JobDispatcher', () => {
  let store: InMemoryJobStore;
  let dispatcher: JobDispatcher;

  beforeEach(() => {
    store = new InMemoryJobStore();
    store.reset();
    dispatcher = new JobDispatcher(store);
  });

  describe('dispatch', () => {
    it('should dispatch a job through the store', async () => {
      const ref = await dispatcher.dispatch('test-job', { foo: 'bar' });
      expect(ref.jobId).toBeDefined();
      expect(ref.jobName).toBe('test-job');
    });

    it('should pass options to the store', async () => {
      const options = { delay: 1000, metadata: { key: 'value' } };
      const ref = await dispatcher.dispatch('test-job', { foo: 'bar' }, options);
      expect(ref.jobId).toBeDefined();
    });
  });

  describe('unschedule', () => {
    it('should unschedule through the store', async () => {
      const scheduleRef = await store.schedule('daily-job', '0 0 * * *');
      const result = await dispatcher.unschedule(scheduleRef.scheduleId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent schedule', async () => {
      const result = await dispatcher.unschedule('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should accept any JobStore implementation', () => {
      const mockStore: JobStore = {
        dispatch: vi.fn().mockResolvedValue({ jobId: 'mock-id', jobName: 'mock-job' }),
        getStatus: vi.fn(),
        cancel: vi.fn(),
        schedule: vi.fn().mockResolvedValue({ scheduleId: 'mock-schedule', jobName: 'mock-job', cron: '* * * * *' }),
        unschedule: vi.fn().mockResolvedValue(true),
      };

      const customDispatcher = new JobDispatcher(mockStore);
      expect(customDispatcher).toBeDefined();
    });
  });
});
