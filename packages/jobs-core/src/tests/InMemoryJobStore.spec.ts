import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryJobStore } from '../libs/InMemoryJobStore';
import { JobState } from '../libs/types';

describe('InMemoryJobStore', () => {
  let store: InMemoryJobStore;

  beforeEach(() => {
    store = new InMemoryJobStore();
    store.reset();
  });

  describe('dispatch', () => {
    it('should dispatch a job and return reference', async () => {
      const ref = await store.dispatch('test-job', { foo: 'bar' });
      expect(ref.jobId).toBeDefined();
      expect(ref.jobName).toBe('test-job');
    });

    it('should store job with pending state', async () => {
      const ref = await store.dispatch('test-job', { data: 1 });
      const status = await store.getStatus(ref.jobId);
      expect(status.state).toBe(JobState.PENDING);
    });
  });

  describe('getStatus', () => {
    it('should return job status', async () => {
      const ref = await store.dispatch('test-job', {});
      const status = await store.getStatus(ref.jobId);
      expect(status.jobId).toBe(ref.jobId);
      expect(status.createdAt).toBeDefined();
      expect(typeof status.createdAt).toBe('number');
    });

    it('should throw error for non-existent job', async () => {
      await expect(store.getStatus('non-existent-id')).rejects.toThrow('Job not found');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending job', async () => {
      const ref = await store.dispatch('test-job', {});
      const result = await store.cancel(ref.jobId);
      expect(result).toBe(true);

      const status = await store.getStatus(ref.jobId);
      expect(status.state).toBe(JobState.CANCELLED);
    });

    it('should return false for non-existent job', async () => {
      const result = await store.cancel('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('schedule', () => {
    it('should create a schedule', async () => {
      const ref = await store.schedule('daily-job', '0 0 * * *');
      expect(ref.scheduleId).toBeDefined();
      expect(ref.cron).toBe('0 0 * * *');
    });
  });

  describe('unschedule', () => {
    it('should remove a schedule', async () => {
      const ref = await store.schedule('daily-job', '0 0 * * *');
      const result = await store.unschedule(ref.scheduleId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent schedule', async () => {
      const result = await store.unschedule('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all jobs', async () => {
      const ref = await store.dispatch('test-job', {});
      store.reset();
      await expect(store.getStatus(ref.jobId)).rejects.toThrow('Job not found');
    });

    it('should clear all schedules', async () => {
      const ref = await store.schedule('daily-job', '0 0 * * *');
      store.reset();
      const result = await store.unschedule(ref.scheduleId);
      expect(result).toBe(false);
    });
  });
});
