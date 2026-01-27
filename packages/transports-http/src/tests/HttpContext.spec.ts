import { describe, expect, it, vi } from 'vitest';
import { HttpContext } from '../libs/HttpContext';

describe('HttpContext', () => {
  it('should parse request properties', () => {
    const url = new URL('https://example.com/test?foo=bar');
    const mockCtx = {
      req: {
        method: 'GET',
        url: url.toString(),
        raw: { headers: new Headers() },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as any);

    expect(ctx.req.method).toBe('GET');
    expect(ctx.req.query.foo).toBe('bar');
  });

  it('should get param value', () => {
    const mockCtx = {
      req: {
        method: 'GET',
        url: 'https://example.com/test',
        raw: { headers: new Headers() },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as any);

    expect(ctx.param('id')).toBeUndefined();
  });

  it('should store and retrieve values', () => {
    const mockCtx = {
      req: {
        method: 'GET',
        url: 'https://example.com/test',
        raw: { headers: new Headers() },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as any);

    ctx.set('user', { id: 1, name: 'test' });
    expect(ctx.get('user')).toEqual({ id: 1, name: 'test' });
  });
});
