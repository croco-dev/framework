import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/rsc-basic');

async function readFixture(name: string) {
  return readFile(join(fixtureDir, name), 'utf8');
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      return result;
    }

    result += decoder.decode(chunk.value, { stream: true });
  }
}

function createFlightLikeStream(payload: string) {
  const body = new TextEncoder().encode(`0:${JSON.stringify(payload)}\n`);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
}

describe('rsc vertical stream pipeline', () => {
  it('creates a stream-like Flight payload from the RSC entry', async () => {
    const { default: RscEntry } = await import('./fixtures/rsc-basic/entry.rsc');
    const stream = createFlightLikeStream(RscEntry().props.children);
    const payload = await readStream(stream);

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(payload).toMatch(/^0:/);
    expect(payload).toContain('RSC:server-only-value');
  });

  it('tees the RSC stream and injects one branch into an SSR HTML shell', async () => {
    const { default: SsrEntry } = await import('./fixtures/rsc-basic/entry.ssr');
    const rscStream = createFlightLikeStream('RSC:server-only-value');
    const [htmlPayloadStream, clientPayloadStream] = rscStream.tee();
    const htmlStream = await renderToReadableStream(createElement(SsrEntry));
    const html = await readStream(htmlStream as ReadableStream<Uint8Array>);
    const htmlPayload = await readStream(htmlPayloadStream);
    const clientPayload = await readStream(clientPayloadStream);
    const shell = `${html}<script type="text/x-component">${htmlPayload}</script>`;

    expect(html).toContain('RSC:server-only-value');
    expect(shell).toContain('<script type="text/x-component">0:');
    expect(clientPayload).toBe(htmlPayload);
  });

  it('detects the browser entry client boundary marker', async () => {
    const source = await readFixture('entry.browser.tsx');

    expect(source.trimStart()).toMatch(/^['"]use client['"];?/);
    expect(source).toContain('Browser:interactive');
  });
});
