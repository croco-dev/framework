import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSsrHandler } from '../libs/CloudflareSsrHandler';
import type { SsrWorkerEnv } from '../libs/types';

vi.mock('vike/server', () => ({
  renderPage: vi.fn(),
}));

describe('createSsrHandler', () => {
  it('createSsrHandler() returns { fetch } object', () => {
    const handler = createSsrHandler();

    expect(handler).toBeInstanceOf(Function);
    expect(handler.length).toBe(3);
  });

  it('function signature type validation - Request, SsrWorkerEnv, ExecutionContext args', async () => {
    const handler = createSsrHandler();

    const mockRequest = new Request('https://example.com/test');
    const mockEnv: SsrWorkerEnv = {};
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    const result = await handler(mockRequest, mockEnv, mockCtx);

    expect(result).toBeDefined();
  });
});
