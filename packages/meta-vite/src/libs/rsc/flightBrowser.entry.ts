/**
 * Browser entrypoint for the React Flight negotiation contract.
 *
 * The package root export is a server entry: it pulls in Node builtins
 * (`node:async_hooks`, `node:fs/promises`) through the render and build
 * modules, so a browser bundle cannot import it. A browser only needs the
 * version handshake: read the client manifest version the rendered document
 * carries and echo it back on Flight requests. That subset lives here, free of
 * server dependencies, so the round trip can run in a real client bundle.
 *
 * `@croco/meta-vite/rsc/browser` resolves to this file in the workspace and to
 * `dist/libs/rsc/flightBrowser.entry.*` in a published install.
 */
export {
  createRscBrowserFlightHeaders,
  readRscClientManifestVersion,
  RSC_CLIENT_MANIFEST_VERSION,
  RSC_FLIGHT_CONTENT_TYPE,
  RSC_MANIFEST_ELEMENT_ID,
} from "./flight";
export type { RscManifestDocument } from "./flight";
