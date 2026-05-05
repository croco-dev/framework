import type { LambdaContext, LambdaEvent, LambdaResponse } from '@croco/transports-http';
import { createCrocoApp } from './app';

const lambdaHandler = createCrocoApp().lambdaHandler();

export async function handler(event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> {
  const apiResponse = await tryApiRequest(event, context);
  if (apiResponse) {
    return apiResponse;
  }

  return renderSsrPage(event);
}

async function tryApiRequest(event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse | null> {
  if (!event.rawPath.startsWith('/api/')) {
    return null;
  }

  return lambdaHandler(event, context);
}

async function renderSsrPage(event: LambdaEvent): Promise<LambdaResponse> {
  const { renderPage } = await import('vike/server');
  const pageContext = await renderPage({
    urlOriginal: createRequestUrl(event),
    headersOriginal: new Headers(event.headers ?? {}),
  });

  const httpResponse = pageContext.httpResponse;
  if (!httpResponse) {
    return {
      statusCode: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'Page not found',
    };
  }

  return {
    statusCode: httpResponse.statusCode,
    headers: Object.fromEntries(httpResponse.headers),
    body: await httpResponse.getBody(),
  };
}

function createRequestUrl(event: LambdaEvent): string {
  const host = event.headers?.host ?? 'lambda.local';
  const path = event.rawPath || '/';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';

  return `https://${host}${path}${query}`;
}
