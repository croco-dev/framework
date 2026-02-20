import type { HttpContext as ProtocolHttpContext } from '@croco/protocols-rest';
import type { Context as HonoContext } from 'hono';
import type { CrocoHttpContext, CrocoRequest, CrocoResponse } from './types';

export class HttpContext implements CrocoHttpContext, ProtocolHttpContext {
  private store = new Map<string, unknown>();

  readonly req: CrocoRequest;
  readonly res: CrocoResponse;
  readonly request: ProtocolHttpContext['request'];
  readonly response: ProtocolHttpContext['response'];

  constructor(readonly raw: HonoContext) {
    const url = new URL(raw.req.url);
    const params = this.extractParams();

    const headers: Record<string, string> = {};
    raw.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    this.req = {
      method: raw.req.method,
      url: raw.req.url,
      path: url.pathname,
      params,
      query: Object.fromEntries(url.searchParams),
      headers,
    };

    this.res = {
      status: 200,
      headers: {},
    };

    this.request = {
      method: this.req.method,
      url: this.req.url,
      headers: this.req.headers,
      params: this.req.params,
      query: this.req.query,
    };

    this.response = this.res;
  }

  param(name: string): string | undefined {
    return this.raw.req.param(name);
  }

  query(name: string): string | undefined {
    return this.raw.req.query(name);
  }

  header(name: string): string | undefined {
    return this.raw.req.header(name);
  }

  async json<T = unknown>(): Promise<T> {
    return this.raw.req.json<T>();
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  text(body: string, status: number = 200): Response {
    return this.raw.text(body, status as Parameters<HonoContext['text']>[1]);
  }

  jsonResponse<T>(body: T, status: number = 200): Response {
    return this.raw.json(body, status as Parameters<HonoContext['json']>[1]);
  }

  redirect(url: string, status: number = 302): Response {
    return this.raw.redirect(url, status as Parameters<HonoContext['redirect']>[1]);
  }

  private extractParams(): Record<string, string> {
    const paramValues = this.raw.req.param();

    if (!paramValues || typeof paramValues !== 'object') {
      return {};
    }

    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(paramValues)) {
      if (typeof value === 'string') {
        params[key] = value;
      }
    }

    return params;
  }
}
