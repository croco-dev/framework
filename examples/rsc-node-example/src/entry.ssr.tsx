import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";

export async function renderHtml(flightStream: ReadableStream<Uint8Array>): Promise<Response> {
  const node = await createFromReadableStream(flightStream);
  const html = await renderToReadableStream(node as never, {
    bootstrapScriptContent: `document.querySelector("[data-testid=refresh]")?.addEventListener("click",()=>location.reload())`,
  });
  void React;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  void request;
  return new Response("use renderHtml(flightStream)", { status: 500 });
}
