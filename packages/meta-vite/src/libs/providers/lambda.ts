import type { CrocoFetchHandler, RuntimeContext } from '../render/types';

type LambdaApiHandler = {
  match: (request: Request) => boolean;
  handle: (request: Request, event: unknown, lambdaContext: unknown) => Promise<Response>;
};

type LambdaComposedOptions = {
  apiHandlers: Array<LambdaApiHandler>;
  pageHandler: CrocoFetchHandler;
};

/**
 * AWS Lambda adapter.
 * Wraps a CrocoFetchHandler for Lambda API Gateway v2 events.
 * Lambda uses a buffered Response by default; streaming responses are not supported by this adapter.
 */
export function createLambdaHandler(
  handler: CrocoFetchHandler
): (event: unknown, context: unknown) => Promise<Response> {
  return async (event: unknown, lambdaContext: unknown) => {
    const request = convertApiGatewayEventToRequest(event);
    const ctx: RuntimeContext = {
      platform: 'lambda',
      event,
      lambdaContext,
    };
    return handler(request, ctx);
  };
}

/**
 * AWS Lambda composed adapter for API routes and page fallback.
 * Lambda requires buffered responses; streaming responses should be handled before returning from this adapter.
 */
export function createLambdaComposedHandler(
  options: LambdaComposedOptions
): (event: unknown, context: unknown) => Promise<Response> {
  return async (event: unknown, lambdaContext: unknown) => {
    const request = convertApiGatewayEventToRequest(event);

    for (const apiHandler of options.apiHandlers) {
      if (apiHandler.match(request)) {
        return apiHandler.handle(request, event, lambdaContext);
      }
    }

    const ctx: RuntimeContext = {
      platform: 'lambda',
      event,
      lambdaContext,
    };

    return options.pageHandler(request, ctx);
  };
}

function convertApiGatewayEventToRequest(event: unknown): Request {
  const evt = event as Record<string, unknown>;
  const requestContext = evt.requestContext as Record<string, unknown> | undefined;
  const http = requestContext?.http as Record<string, unknown> | undefined;
  const headers = (evt.headers as Record<string, string> | undefined) ?? {};
  const method = (http?.method as string | undefined) ?? (evt.httpMethod as string | undefined) ?? 'GET';
  const path = (evt.rawPath as string | undefined) ?? (evt.path as string | undefined) ?? '/';
  const queryString = evt.rawQueryString ? `?${evt.rawQueryString}` : '';
  const body = evt.body as string | undefined;
  const isBase64 = evt.isBase64Encoded as boolean | undefined;
  const baseUrl = headers['x-forwarded-proto'] === 'https' ? 'https://' : 'http://';
  const host = headers.host ?? 'lambda.local';

  let requestBody: BodyInit | undefined;
  if (body && isBase64) {
    requestBody = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  } else if (body) {
    requestBody = body;
  }

  return new Request(`${baseUrl}${host}${path}${queryString}`, {
    method,
    headers,
    body: requestBody,
  });
}
