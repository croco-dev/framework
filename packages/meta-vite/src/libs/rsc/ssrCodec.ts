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
// NOTE: the static react-dom/server imports below intentionally resolve at
// module load. `react-server-dom-webpack` stays an optional peer plus dev
// dependency (lazy `import()` only on the RSC path): non-RSC consumers never
// install or load the Flight codec, while the published tarball consumer
// resolves `dist/index.mjs` without it unless an `rsc` route is handled.
import { renderToReadableStream, renderToString } from "react-dom/server";
import type { RscClientManifestLike, RscSsrCodec, RscSsrDecodeOptions } from "./ssrDecode";

type FlightClientModule = {
  readonly createFromReadableStream: (
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ) => Promise<unknown>;
};

// Lazily resolved per decode via a variable specifier so `tsc` does not try
// to resolve the untyped Flight client entry to `client.browser.js` (which
// has no types). Types come from `src/rsc-flight-codec.d.ts`.
async function loadFlightClient(): Promise<
  (stream: ReadableStream<Uint8Array>, options?: unknown) => Promise<unknown>
> {
  const specifier = "react-server-dom-webpack/client" as string;
  const client = (await import(/* @vite-ignore */ specifier)) as unknown as FlightClientModule;
  return client.createFromReadableStream;
}

export function createRscSsrCodec(): RscSsrCodec {
  return {
    decodeFlight: async (flight, manifest) => {
      const decode = await loadFlightClient();
      return decode(flight, { serverConsumerManifest: manifest });
    },
    renderHtmlStream: async (node, _options?: RscSsrDecodeOptions) =>
      renderToReadableStream(
        node as never,
        undefined as never,
      ) as unknown as ReadableStream<Uint8Array>,
    renderHtmlString: (node) => renderToString(node as never),
    emptyManifest: (): RscClientManifestLike => ({ moduleMap: {}, serverModuleMap: {} }),
  };
}
