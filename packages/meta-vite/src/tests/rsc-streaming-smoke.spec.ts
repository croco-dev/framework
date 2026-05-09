import { describe, expect, it } from 'vitest';

async function mockFetchHandler(request: Request): Promise<Response> {
  const body = createBodyStream(`RSC smoke: ${request.method} ${new URL(request.url).pathname}`);

  return new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

function createBodyStream(payload: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`<html><body>${payload}</body></html>`));
      controller.close();
    },
  });
}

describe('rsc streaming response smoke', () => {
  it('returns a valid Response object from a fetch-like handler', async () => {
    const response = await mockFetchHandler(new Request('https://example.test/rsc'));

    expect(response).toBeInstanceOf(Response);
    expect(response.ok).toBe(true);
  });

  it('returns a readable stream body', async () => {
    const response = await mockFetchHandler(new Request('https://example.test/rsc'));
    const reader = response.body?.getReader();

    expect(reader).toBeDefined();

    const chunk = await reader?.read();
    expect(chunk?.done).toBe(false);
    expect(new TextDecoder().decode(chunk?.value)).toContain('RSC smoke: GET /rsc');
  });

  it('sets an HTML content-type header for the streaming shell', async () => {
    const response = await mockFetchHandler(new Request('https://example.test/rsc'));

    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
});
