# RSC Node Example

Real React Flight + server/client boundary path built on `@vitejs/plugin-rsc`
(official encoder/decoder — never a hand-rolled reimplementation).

## What it proves

- `src/entry.rsc.tsx` — async server component (`SlowFact` Suspense boundary),
  server-only data (`SERVER_ONLY_VALUE`, never in the client bundle), and an
  interactive `"use client"` island (`Counter.tsx`).
- `src/entry.ssr.tsx` — decodes Flight with the official
  `@vitejs/plugin-rsc/ssr` `createFromReadableStream`, renders HTML with
  `react-dom/server`.
- `src/entry.browser.tsx` — hydrates via
  `@vitejs/plugin-rsc/browser` `createFromFetch`.
- `serve.mjs` — one Node production server: HTML vs Flight negotiated on one
  path (`Accept: text/x-component` or `.rsc` suffix); the HTML shell is always
  decoded from the same Flight bytes the browser fetches.

## Run

```bash
cd examples/rsc-node-example
pnpm install
NODE_ENV=production ./node_modules/.bin/vite build
NODE_ENV=production PORT=4317 node serve.mjs
curl http://localhost:4317/                                   # HTML shell
curl -H 'Accept: text/x-component' http://localhost:4317/     # Flight rows
curl http://localhost:4317/index.rsc                          # Flight rows
```

`NODE_ENV=production` is required on both build and serve: a Flight payload
encoded by a React development build cannot be decoded by a production client
(React throws a version-mismatch page error and hydration silently fails).

## Secret-leak check

```bash
grep -c 'RSC:server-only-value' dist/client/assets/*.js   # must print 0
grep -o 'RSC:server-only-value' dist/rsc/index.js | head -1
```

## Scope note

Node production path only. Workers/Lambda stay undeclared until verified
against a real host contract (issue #2835 acceptance).
