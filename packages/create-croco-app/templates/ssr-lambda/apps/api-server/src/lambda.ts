import { createLambdaComposedHandler } from '@croco/meta-vite';
import type { LambdaContext, LambdaEvent, LambdaResponse } from '@croco/transports-http';
import { createCrocoApp } from './app';

const app = createCrocoApp();

const apiHandler = {
  match: (request: Request) => new URL(request.url).pathname.startsWith('/api/'),
  handle: async (request: Request, _event: unknown, _lambdaContext: unknown): Promise<Response> => {
    const fetchHandler = app.lambdaHandler();
    return fetchHandler(request);
  },
};

let pageHandler: ((request: Request) => Promise<Response>) | null = null;

async function getPageHandler() {
  if (!pageHandler) {
    const { RouteRegistry } = await import('@croco/meta-vite');
    const { RenderServer } = await import('@croco/meta-vite');

    const registry = new RouteRegistry();
    const server = new RenderServer(registry.compile());
    pageHandler = async (request: Request) => server.handle(request);
  }
  return pageHandler;
}

const handler = createLambdaComposedHandler({
  apiHandlers: [apiHandler],
  pageHandler: async (request: Request) => {
    const pageFn = await getPageHandler();
    return pageFn(request);
  },
});

export async function lambdaHandler(event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> {
  const response = await handler(event, context);

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
}

export { lambdaHandler as handler };
