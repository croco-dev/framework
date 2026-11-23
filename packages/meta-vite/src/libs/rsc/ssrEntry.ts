/**
 * `@croco/meta-vite/rsc/ssr`: helper for the app's `ssr` Vite entry.
 *
 * The Flight decoder and the client entry URL come from
 * `@vitejs/plugin-rsc/ssr`, which reads the build's client reference and asset
 * manifests. Those manifests are virtual modules that exist only inside the
 * app's Vite build, so the host cannot decode client islands itself and calls
 * this entry instead.
 */
import { RSC_SSR_ENTRY_VERSION } from "./buildEntry";
import type { RscHtmlRenderInput, RscSsrEntry } from "./buildEntry";

export type RscSsrEntryOptions = {
  /** `createFromReadableStream` from `@vitejs/plugin-rsc/ssr`. */
  readonly createFromReadableStream: (flight: ReadableStream<Uint8Array>) => Promise<unknown>;
  /** `getClientEntryUrl` from `@vitejs/plugin-rsc/ssr`. */
  readonly getClientEntryUrl: () => string;
  /** `renderToReadableStream` from `react-dom/server`. */
  readonly renderToReadableStream: (
    node: never,
    options: { readonly signal: AbortSignal; readonly bootstrapModules: string[] },
  ) => Promise<ReadableStream<Uint8Array>>;
};

export function defineRscSsrEntry(options: RscSsrEntryOptions): RscSsrEntry {
  const clientEntryUrl = options.getClientEntryUrl();
  return {
    version: RSC_SSR_ENTRY_VERSION,
    clientEntryUrl,
    async renderHtml(input: RscHtmlRenderInput) {
      const node = await options.createFromReadableStream(input.flight);
      // React writes bootstrap modules as `async` right after the shell, so the
      // client entry runs while late boundaries are still streaming instead of
      // after the whole document, as a deferred module script would.
      return options.renderToReadableStream(node as never, {
        signal: input.signal,
        bootstrapModules: [clientEntryUrl],
      });
    },
  };
}

export { RSC_SSR_ENTRY_VERSION } from "./buildEntry";
export type { RscHtmlRenderInput, RscSsrEntry } from "./buildEntry";
