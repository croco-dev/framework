import 'reflect-metadata';
import { Body } from '@croco/protocols-rest';
import { describe, expect, it, vi } from 'vitest';
import { ParamResolver } from '../libs/ParamResolver';
import type { CrocoHttpContext } from '../libs/types';

function createMockHttpContext(json: CrocoHttpContext['json']): CrocoHttpContext {
  const request = new Request('http://localhost/test');
  const store = new Map<string, unknown>();

  return {
    req: {
      method: 'POST',
      url: request.url,
      path: '/test',
      params: {},
      query: {},
      headers: {},
    },
    res: {
      status: 200,
      headers: {},
    },
    raw: {
      req: {
        raw: request,
      },
    } as CrocoHttpContext['raw'],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn(),
    json,
    set: (key, value) => {
      store.set(key, value);
    },
    get: <T>(key: string) => store.get(key) as T | undefined,
    text: vi.fn().mockImplementation((body: string, status: number = 200) => new Response(body, { status })),
    jsonResponse: vi
      .fn()
      .mockImplementation((body: unknown, status: number = 200) => new Response(JSON.stringify(body), { status })),
    redirect: vi.fn().mockImplementation((url: string, status: number = 302) => Response.redirect(url, status)),
  };
}

describe('ParamResolver', () => {
  it('BUG-03 @Body를 여러 번 사용해도 body를 한 번만 파싱', async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const parsedBody = { name: 'croco' };
    const json = vi.fn(async () => {
      if (json.mock.calls.length > 1) {
        throw new TypeError('Body already read');
      }
      return parsedBody;
    });

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext['json']);

    const args = await resolver.resolveParams(ctx, TestController, 'create');

    expect(args).toEqual([parsedBody, parsedBody]);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('동일 요청 컨텍스트에서 resolveParams를 다시 호출해도 body 캐시를 재사용', async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const parsedBody = { id: '1' };
    const json = vi.fn(async () => parsedBody);

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext['json']);

    await resolver.resolveParams(ctx, TestController, 'create');
    const args = await resolver.resolveParams(ctx, TestController, 'create');

    expect(args).toEqual([parsedBody, parsedBody]);
    expect(json).toHaveBeenCalledTimes(1);
  });
});
