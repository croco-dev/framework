import type { Hono, HonoRequest } from 'hono';
import type { LambdaContext, LambdaEvent, LambdaHandler } from './types';

function isBinaryContentType(contentType: string): boolean {
  const mimeType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';

  if (mimeType === '') {
    return false;
  }

  if (mimeType.startsWith('text/')) {
    return false;
  }

  if (
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    mimeType === 'application/x-www-form-urlencoded'
  ) {
    return false;
  }

  return true;
}

export interface LambdaExecutionEnv {
  event: LambdaEvent;
  lambdaContext: LambdaContext;
}

export type TypedLambdaHandler = (
  event: LambdaEvent,
  context: LambdaContext
) => Promise<{
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}>;

export class CrocoLambdaAdapter {
  constructor(private readonly hono: Hono) {}

  createHandler(): LambdaHandler {
    return async (event: LambdaEvent, lambdaContext: LambdaContext) => {
      const method = event.requestContext?.http?.method ?? 'GET';
      const path = event.rawPath ?? '/';
      const queryString = event.rawQueryString ?? '';
      const url = `https://lambda.local${path}${queryString ? `?${queryString}` : ''}`;

      const headers = new Headers();
      if (event.headers) {
        for (const [key, value] of Object.entries(event.headers)) {
          if (value !== undefined && value !== null) {
            headers.set(key, value);
          }
        }
      }

      let body: BodyInit | null = null;
      if (event.body) {
        body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
      }

      const request = new Request(url, {
        method,
        headers,
        body: ['GET', 'HEAD'].includes(method) ? null : body,
      });

      const executionEnv: LambdaExecutionEnv = {
        event,
        lambdaContext,
      };

      const response = await this.hono.fetch(request, executionEnv);

      const contentType = response.headers.get('content-type') ?? '';
      const isBinary = isBinaryContentType(contentType);
      const responseBody = isBinary
        ? Buffer.from(await response.arrayBuffer()).toString('base64')
        : await response.text();
      const responseHeaders: Record<string, string> = {};

      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: responseBody,
        isBase64Encoded: isBinary,
      };
    };
  }

  getExecutionEnv(c: { env: LambdaExecutionEnv }): LambdaExecutionEnv {
    return c.env;
  }
}

export function getLambdaEvent(honoRequest: HonoRequest): LambdaEvent | undefined {
  const env = honoRequest.raw as unknown as { env?: LambdaExecutionEnv };
  return env.env?.event;
}

export function getLambdaContext(honoRequest: HonoRequest): LambdaContext | undefined {
  const env = honoRequest.raw as unknown as { env?: LambdaExecutionEnv };
  return env.env?.lambdaContext;
}
