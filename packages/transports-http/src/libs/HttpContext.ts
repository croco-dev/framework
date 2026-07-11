import type { HttpContext as ProtocolHttpContext } from "@croco/protocols-rest";
import type { Context as HonoContext } from "hono";
import type { CrocoHttpContext, CrocoRequest, CrocoResponse } from "./types";

/**
 * Hono 컨텍스트를 Croco 전용 HTTP 컨텍스트 인터페이스로 감싸는 어댑터입니다.
 */
export class HttpContext implements CrocoHttpContext, ProtocolHttpContext {
  private store = new Map<string, unknown>();
  private bufferedResponseBody: Uint8Array<ArrayBuffer> | null = null;

  readonly req: CrocoRequest;
  readonly res: CrocoResponse;
  readonly request: ProtocolHttpContext["request"];
  readonly response: ProtocolHttpContext["response"];

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
      query: toQueryRecord(url.searchParams),
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

  query(name: string): string | string[] | undefined {
    return this.req.query[name];
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
    this.res.status = status;
    this.bufferedResponseBody = toBufferedBytes(body);
    return this.raw.text(body, status as Parameters<HonoContext["text"]>[1]);
  }

  jsonResponse<T>(body: T, status: number = 200): Response {
    this.res.status = status;
    const serializedBody = JSON.stringify(body);
    this.bufferedResponseBody =
      typeof serializedBody === "string" ? toBufferedBytes(serializedBody) : null;
    return this.raw.json(body, status as Parameters<HonoContext["json"]>[1]);
  }

  redirect(url: string, status: number = 302): Response {
    this.res.status = status;
    this.clearBufferedResponseBody();
    return this.raw.redirect(url, status as Parameters<HonoContext["redirect"]>[1]);
  }

  getBufferedResponseBody(): Uint8Array<ArrayBuffer> | null {
    if (!this.bufferedResponseBody) {
      return null;
    }

    return toBufferedBytes(this.bufferedResponseBody);
  }

  clearBufferedResponseBody(): void {
    this.bufferedResponseBody = null;
  }

  private extractParams(): Record<string, string> {
    const paramValues = this.raw.req.param();

    if (!paramValues || typeof paramValues !== "object") {
      return {};
    }

    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(paramValues)) {
      if (typeof value === "string") {
        params[key] = value;
      }
    }

    return params;
  }
}

function toQueryRecord(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = query[key];

    if (existing === undefined) {
      query[key] = value;
      return;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
      return;
    }

    query[key] = [existing, value];
  });

  return query;
}

function toBufferedBytes(body: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy;
}
