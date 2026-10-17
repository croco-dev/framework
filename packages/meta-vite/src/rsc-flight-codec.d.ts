declare module "react-server-dom-webpack/client" {
  function createFromReadableStream(
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ): Promise<unknown>;
}

declare module "react-server-dom-webpack/server.node" {
  function renderToReadableStream(element: unknown, options?: unknown): ReadableStream<Uint8Array>;
}
