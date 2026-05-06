import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '../fetch';
import { createCloudflarePreset, createWorkerFetchHandler } from '../index';

const createExecutionContext = (): ExecutionContext => ({
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
});

describe('createCloudflarePreset', () => {
  it('returns a cloudflare preset', () => {
    const preset = createCloudflarePreset();

    expect(preset.name).toBe('cloudflare');
    expect(preset.config.name).toBe('cloudflare');
  });

  it('uses the Worker fetch entry point', () => {
    const preset = createCloudflarePreset();

    expect(preset.config.entry).toBe('./fetch.js');
  });
});

describe('createWorkerFetchHandler', () => {
  it('returns a function', () => {
    const handler = createWorkerFetchHandler({ fetch: async () => new Response('ok') });

    expect(typeof handler).toBe('function');
  });

  it('passes requests to the underlying Hono app', async () => {
    const request = new Request('https://example.com/users');
    const response = new Response('ok');
    const fetch = vi.fn(async () => response);
    const handler = createWorkerFetchHandler({ fetch });

    await expect(handler(request, {}, createExecutionContext())).resolves.toBe(response);
    expect(fetch).toHaveBeenCalledWith(request);
  });
});
