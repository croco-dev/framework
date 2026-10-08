declare module "react-server-dom-webpack/client" {
  const createFromReadableStream: (
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ) => Promise<unknown>;
  export { createFromReadableStream };
}

declare module "react-server-dom-webpack/server.node" {
  const renderToReadableStream: (element: unknown, options?: unknown) => ReadableStream<Uint8Array>;
  export { renderToReadableStream };
}
