import { renderToReadableStream } from "react-dom/server";
import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";

export async function renderHtml(flightStream: ReadableStream<Uint8Array>): Promise<Response> {
  const node = await createFromReadableStream(flightStream);
  // The browser entry owns the refresh path (fetch `.rsc` and re-render into
  // the same root), so no inline bootstrap script is injected here.
  const html = await renderToReadableStream(node as never);
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default async function handler(_request: Request): Promise<Response> {
  return new Response("use renderHtml(flightStream)", { status: 500 });
}
