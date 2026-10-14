# RSC Node Example

Real React Flight + server/client boundary path built on `@vitejs/plugin-rsc`
(official encoder/decoder — never a hand-rolled reimplementation).

## What it proves

- `src/entry.rsc.tsx` — async server component (`SlowFact` Suspense boundary),
  server-only data (`SERVER_ONLY_VALUE`, never in the client bundle), an
  interactive `"use client"` island (`Counter.tsx`), and a plain refresh button
  whose click handler lives in the browser entry.
- `src/entry.ssr.tsx` — decodes Flight with the official
  `@vitejs/plugin-rsc/ssr` `createFromReadableStream`, renders HTML with
  `react-dom/server`.
- `src/entry.browser.tsx` — hydrates via
  `@vitejs/plugin-rsc/browser` `createFromFetch` and `hydrateRoot` (the server
  HTML is already in `#root`); Refresh re-fetches `.rsc` and renders the new
  Flight node into the same root. Every `.rsc` fetch carries
  `createRscBrowserFlightHeaders()`, which reads the manifest version out of the
  document it is running in. It is imported from
  `@croco/meta-vite/rsc/browser`: the package root is a server entry, so only
  that subpath can be bundled for a browser.
- `vite.config.ts` — `crocoMetaVitePlugin({ rsc: true })` enables the Flight
  environments and records the client build id as
  `dist/client/croco-rsc-client-build.json`. Vite loads the config with Node,
  so the plugin source is imported by path here; a published consumer imports
  `crocoMetaVitePlugin` from `@croco/meta-vite` as usual.
- `serve.mjs` — one Node production server: HTML vs Flight negotiated on one
  path (`Accept: text/x-component` or `.rsc` suffix); the HTML shell is always
  decoded from the same Flight bytes the browser fetches. Both responses are
  streamed (`Transfer-Encoding: chunked`), so the shell and the first rows
  arrive before the slow Suspense boundary resolves. It serves exactly one
  client build: the build file's `clientManifestVersion` is the version a Flight
  request has to echo back, so a browser holding a document from an older build
  is refused instead of decoding a payload it cannot reference.

## Run

```bash
cd examples/rsc-node-example
pnpm install
NODE_ENV=production ./node_modules/.bin/vite build
NODE_ENV=production PORT=4317 node serve.mjs
curl http://localhost:4317/                                                            # HTML shell
curl -H 'Accept: text/x-component' http://localhost:4317/                               # rejected: manifest version missing
curl -H 'Accept: text/x-component' -H 'x-croco-rsc-client-manifest: <version>' http://localhost:4317/
curl http://localhost:4317/index.rsc -H 'x-croco-rsc-client-manifest: <version>'        # Flight rows
```

`<version>` is the `clientManifestVersion` recorded by the build; a browser
reads it from the rendered document, so a script does not have to:

```bash
VERSION=$(node -p "require('./dist/client/croco-rsc-client-build.json').clientManifestVersion")
curl -H "x-croco-rsc-client-manifest: $VERSION" http://localhost:4317/index.rsc
```

`NODE_ENV=production` is required on both build and serve: a Flight payload
encoded by a React development build cannot be decoded by a production client
(React throws a version-mismatch page error and hydration silently fails). The
`serve` script (`pnpm serve`) sets it for you.

## Client-manifest check

```bash
VERSION=$(node -p "require('./dist/client/croco-rsc-client-build.json').clientManifestVersion")
curl -i -H "x-croco-rsc-client-manifest: $VERSION" http://localhost:4317/index.rsc | grep 'x-croco-rsc-client-manifest'   # echoed version
curl -i -X GET -H 'x-croco-rsc-client-manifest: stale' http://localhost:4317/index.rsc | head -n 1
# HTTP/1.1 400 — {"error":"RSC client manifest mismatch",...}
curl -i http://localhost:4317/index.rsc | head -n 1
# HTTP/1.1 400 — a request without the header is refused the same way
```

## Secret-leak check

```bash
grep -c 'RSC:server-only-value' dist/client/assets/*.js   # must print 0
grep -o 'RSC:server-only-value' dist/rsc/index.js | head -1
```

## Scope note

Node production path only. Workers/Lambda stay undeclared until verified
against a real host contract (issue #2835 acceptance).
