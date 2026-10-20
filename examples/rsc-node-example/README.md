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

## Production PDP performance lab (#2841)

`/products/orbit` is a synthetic product-detail fixture on this same real Node
Flight pipeline. It uses parallel filesystem reads for public product content,
a reserved hero layout, one interactive preview CTA, and a Suspense recommendation
region. The preview changes local UI state; it does not assert price, purchasing
eligibility or a completed purchase. Missing products return 404.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build --filter=@croco-example/rsc-node...
pnpm --dir packages/docs run playwright:install
pnpm --filter @croco-example/rsc-node test:performance /tmp/croco-pdp-evidence
```

Build and serve both use production mode. The lab starts its own loopback-only
server and project-owned headless Chromium, closes both, and writes evidence
outside the checkout by default. The existing benchmark workflow runs these same
commands and uploads the JSON, Markdown, inspector and screenshots. No account,
production identity, remote CDN request, database or operational RUM is used.

`performance/profile.mjs` declares critical/deferred regions, responsive image
widths and sizes, viewport, device scale, CPU/network constraints, repetitions,
structural payload/request budgets and permitted timing deltas from the measured
baseline. These are adjustable starting budgets for this fixture, not an SLA for
all applications. The example resolves the Problems ESM source while bundling;
this avoids pulling an opaque prebuilt CommonJS registry into the browser. It
measures the workspace production artifact, not an installed tarball consumer.

All four registered configurations use the same URL, data, client build and
profile. Only the named optional integrations change:

| Configuration   | Actual integration                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| baseline        | Public PDP + real Flight encoder/SSR/browser decoder                                                               |
| experiment      | `ExperimentRuntime` + `ExperimentDeliveryBridge`, immutable admitted supporting-copy decision                      |
| personalization | `loadPersonalizedFragments`, `InMemoryCacheStore`, shared public fragment and request-local private recommendation |
| combined        | Both integrations on the same PDP                                                                                  |

The fixture's **synthetic** `lab-user` cookie selects Alice or Bob. It is not an
authentication example. Final HTML and Flight are private/no-store; private values
and receipts never enter the shared fragment cache. The experiment measurement includes assignment/admission, the native
`ExperimentRegion` browser boundary and its display-exposure request. It does not
measure conversion delivery. It adds no allocator. Optional recommendation failure yields
an explicit unavailable region and diagnostic, leaving the real CTA usable. The
browser hydrates the exact initial Flight bytes embedded with the document, rather
than assigning again during hydration. Refresh fetches a new negotiated Flight
snapshot and preserves a working client boundary. A stale manifest is rejected.

The real `CloudflareImagesProvider` generates width/height transformation paths.
The loopback fixture serves predefined SVG artwork at those paths. This validates
adapter URL composition, browser `srcset`/`sizes` selection, explicit dimensions,
selective hero priority, lazy below-fold images and byte accounting. It does **not**
measure a live CDN, image transformation quality, a codec or remote provider latency.

Each configuration produces `passed`, `failed`, `unsupported` or `not_run` with an
artifact reference, dependency/browser versions, conditions, raw samples and budget
results. Currently all four have executable integrations; the lab must run them.
A later unavailable integration must carry its concrete missing API/issue reason;
unsupported or unexecuted rows cannot count as certification. Exceptions produce
`failure.json`, retaining completed rows and explicitly marking unstarted rows.
`report.json` is authoritative, `report.md` summarizes its rows, and
`inspector.html` displays that exact report without recalculating measurements.

Cold samples use a fresh browser context and cleared fragment store. Warm samples
first load the same configuration in that context, then navigate again with its
browser and fragment caches retained. Each mode runs three repetitions. Reports
record document TTFB, public-loader timing/waterfall, first visible critical shell,
decoded/visible hero, browser LCP, decoded HTML/embedded Flight/JS/image bytes,
actual transfer bytes, requests, fragment source, hydration-ready time and keyboard-click-to-next-paint
latency. The current fixture hydrates when its initial Flight snapshot is complete;
hydration-ready time includes deferred-content waiting.
Click-to-next-paint is a **lab interaction measurement, not field INP**. Missing
measurements fail; they are never zero-filled. Timing deltas require identical
artifact, fixture, versions, user, viewport, network, CPU, cache mode and repetition.

The lab also injects a held blocking fetch, oversized valid JS and image responses,
a missing responsive image policy, an initial/hydrated snapshot discrepancy and private-content contamination. Each
must be rejected. Separate browser checks verify optional-source failure, Alice/Bob
isolation, mobile/desktop overflow, keyboard/ARIA behavior, no unexpected browser
errors, manifest/status handling, actual shell visibility while the recommendation
fetch is held, stable hero geometry after release, and a fresh decoded refresh.
Synthetic negative-control errors are evidence of rejection, not healthy-page errors.

### Infrastructure decisions

| Profile                | PDP lab path                | Provider / constraint / evidence                                                                                                                         |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kubernetes (Node Host) | unverified deployment       | Existing Node Flight example and process-local cache/experiment stores; local Node HTTP + Chromium evidence only, no cluster or durability certification |
| AWS Lambda             | unsupported in this fixture | The example uses a listening Node server, filesystem reads and process-local lab controls; no Lambda Host/flush lifecycle integration is selected        |
| Cloudflare Workers     | unsupported in this fixture | This Node Flight entry uses Node filesystem and HTTP APIs; the image URL adapter does not imply Workers Flight support                                   |

Tool completion, the four configuration results, infrastructure certification and
npm release are separate states. The public image/cache/experiment contracts and
package runtime catalog are unchanged. This lab requires neither the warehouse
add-on (#2878) nor a new performance service. Broader deployment integrations must
activate this same registered fixture and gather their own evidence.
