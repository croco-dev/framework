import type { LambdaContext, LambdaEvent, LambdaHandler, LambdaResponse } from '@croco/transports-http';

export type { LambdaContext, LambdaEvent, LambdaHandler, LambdaResponse };

export function createLambdaHandler(honoApp: { readonly fetch: (req: Request) => Promise<Response> }): LambdaHandler {
  return async (event: LambdaEvent, _context: LambdaContext): Promise<LambdaResponse> => {
    const queryString = event.queryStringParameters
      ? `?${new URLSearchParams(filterQueryParameters(event.queryStringParameters)).toString()}`
      : '';
    const url = `${event.path}${queryString}`;
    const method = event.httpMethod;
    const request = new Request(url, {
      method,
      headers: event.headers ?? {},
      body: ['GET', 'HEAD'].includes(method) ? undefined : readBody(event),
    });

    const response = await honoApp.fetch(request);
    const responseHeaders: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text(),
      isBase64Encoded: false,
    };
  };
}

function filterQueryParameters(queryStringParameters: Record<string, string | null>): [string, string][] {
  return Object.entries(queryStringParameters).filter((entry): entry is [string, string] => entry[1] !== null);
}

function readBody(event: LambdaEvent): string | undefined {
  const body = event.body ?? undefined;

  if (event.isBase64Encoded && body) {
    return Buffer.from(body, 'base64').toString('utf-8');
  }

  return body;
}
