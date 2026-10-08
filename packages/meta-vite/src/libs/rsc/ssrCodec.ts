// @croco/meta-vite RSC SSR codec.
//
// This module runs WITHOUT the `react-server` condition: it decodes an
// already-encoded Flight stream with the official
// `react-server-dom-webpack/client` decoder and renders the result to HTML
// with `react-dom/server`. It is loaded lazily (dynamic import) only when an
// `rsc`-mode route is actually handled, so non-RSC consumers never pay for —
// or need installed — the Flight decoder. It must never import a `server.*`
// Flight module; the Flight encoder side requires the `react-server`
// condition (or the `rsc` Vite environment) and therefore lives behind
// `flightEncode.ts` and the isolated encoder entry used by
// `encodeRscFlightInIsolatedEncoder`.
//
// NOTE: the static imports below intentionally resolve at module load. They
// are the price of the real Flight path: keeping `react-server-dom-webpack`
// a direct dependency (not dev-only) is what makes the published tarball
// consumer resolve `dist/index.mjs`.
import { renderToReadableStream, renderToString } from "react-dom/server";
import { createFromReadableStream } from "react-server-dom-webpack/client";
import type { RscClientManifestLike, RscSsrCodec, RscSsrDecodeOptions } from "./ssrDecode";

type ClientModule = {
  readonly createFromReadableStream: (
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ) => Promise<unknown>;
};

const client = createFromReadableStream as unknown as ClientModule["createFromReadableStream"];

export function createRscSsrCodec(): RscSsrCodec {
  return {
    decodeFlight: async (flight, manifest) => client(flight, { serverConsumerManifest: manifest }),
    renderHtmlStream: async (node, _options?: RscSsrDecodeOptions) =>
      renderToReadableStream(
        node as never,
        undefined as never,
      ) as unknown as ReadableStream<Uint8Array>,
    renderHtmlString: (node) => renderToString(node as never),
    emptyManifest: (): RscClientManifestLike => ({ moduleMap: {}, serverModuleMap: {} }),
  };
}
