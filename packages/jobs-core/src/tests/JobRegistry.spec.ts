import { beforeEach, describe, expect, it } from 'vitest';
import type { JobHandler, JobMetadata } from '../libs/decorators/Job';
import { JobRegistry } from '../libs/JobRegistry';

describe('JobRegistry', () => {
  let registry: JobRegistry;

  beforeEach(() => {
    registry = JobRegistry.getInstance();
    registry.reset();
  });

  it('should be a singleton', () => {
    const instance1 = JobRegistry.getInstance();
    const instance2 = JobRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should register and retrieve handlers', () => {
    const handler: JobHandler = { handle: async () => {} };
    const metadata: JobMetadata = {
      name: 'test-job',
      target: class TestHandler {},
    };
    registry.register('test-job', handler, metadata);

    const registered = registry.get('test-job');
    expect(registered).toBeDefined();
    expect(registered?.handler).toBe(handler);
    expect(registered?.metadata).toBe(metadata);
  });

  it('should check if handler exists', () => {
    const handler: JobHandler = { handle: async () => {} };
    const metadata: JobMetadata = {
      name: 'test-job',
      target: class TestHandler {},
    };
    registry.register('test-job', handler, metadata);

    expect(registry.has('test-job')).toBe(true);
    expect(registry.has('unknown-job')).toBe(false);
  });

  it('should return all registered jobs', () => {
    const handler1: JobHandler = { handle: async () => {} };
    const handler2: JobHandler = { handle: async () => {} };
    const metadata1: JobMetadata = {
      name: 'job-1',
      target: class Handler1 {},
    };
    const metadata2: JobMetadata = {
      name: 'job-2',
      target: class Handler2 {},
    };

    registry.register('job-1', handler1, metadata1);
    registry.register('job-2', handler2, metadata2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });

  it('should return undefined for non-existent job', () => {
    const registered = registry.get('non-existent');
    expect(registered).toBeUndefined();
  });

  it('should reset all handlers', () => {
    const handler: JobHandler = { handle: async () => {} };
    const metadata: JobMetadata = {
      name: 'test-job',
      target: class TestHandler {},
    };
    registry.register('test-job', handler, metadata);

    registry.reset();

    expect(registry.has('test-job')).toBe(false);
    expect(registry.getAll()).toHaveLength(0);
  });
});
