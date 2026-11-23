# RSC Node Example

Real React Flight + server/client boundary path built on `@vitejs/plugin-rsc`
(official encoder/decoder — never a hand-rolled reimplementation).

## What it proves

- `src/entry.rsc.tsx` — async server component (`SlowFact` Suspense boundary),
  server-only data (`SERVER_ONLY_VALUE`, never in the client bundle), an
  interactive `"use client"` island (`Counter.tsx`), and a plain refresh button
  whose click handler lives in the browser entry. Routes are declared with
  `defineRscServerEntry()` from `@croco/meta-vite/rsc/server`; the official
  `@vitejs/plugin-rsc/rsc` encoder is passed in. The performance lab's hooks are
  declared as `actions`, because they share the experiment bridge and cache the
  rendered pages use.
- `src/entry.ssr.tsx` — `defineRscSsrEntry()` from `@croco/meta-vite/rsc/ssr`
  with the official `@vitejs/plugin-rsc/ssr` decoder and `react-dom/server`.
- `src/entry.browser.tsx` — hydrates with `hydrateRoot` from the Flight bytes
  streamed into the document (`readRscInitialFlight()`), so the page is not
  rendered twice and the shell hydrates before late Suspense boundaries
  resolve; Refresh re-fetches `.rsc` and renders the new Flight node into the
  same root. Every `.rsc` fetch carries `createRscBrowserFlightHeaders()`, which
  reads the manifest version out of the document it is running in. Both come
  from `@croco/meta-vite/rsc/browser`: the package root is a server entry, so
  only that subpath can be bundled for a browser.
- `vite.config.ts` — `crocoMetaVitePlugin({ rsc: true })` enables the Flight
  environments and records the client build id as
  `dist/client/croco-rsc-client-build.json`. Vite loads the config with Node,
  so the plugin source is imported by path here; a published consumer imports
  `crocoMetaVitePlugin` from `@croco/meta-vite` as usual.
- `server.ts` — the production server on the public meta-vite adapter:
  `loadRscBuild()` loads the build into its worker thread, `RenderServer`
  negotiates HTML vs Flight on one path (`Accept: text/x-component` or `.rsc`
  suffix) and streams both, `createRscAssetHandler()` serves the hashed client
  bundle, and `createNodeComposedHandler({ origin })` refuses requests for any
  other origin. The `/lab/*` and image endpoints are the performance lab and
  stay example-only; they reach the worker through `build.invokeAction()`.
  `vite.server.config.ts` bundles this file to `dist/server/server.js`, because
  workspace packages resolve to TypeScript sources that plain Node cannot load.

## Run

```bash
cd examples/rsc-node-example
pnpm install
pnpm build
PORT=4317 pnpm serve
curl http://127.0.0.1:4317/                                                            # HTML shell
curl -H 'Accept: text/x-component' http://127.0.0.1:4317/                               # rejected: manifest version missing
curl -H 'Accept: text/x-component' -H 'x-croco-rsc-client-manifest: <version>' http://127.0.0.1:4317/
curl http://127.0.0.1:4317/.rsc -H 'x-croco-rsc-client-manifest: <version>'        # Flight rows
```

`<version>` is the `clientManifestVersion` recorded by the build; a browser
reads it from the rendered document, so a script does not have to:

```bash
VERSION=$(node -p "require('./dist/client/croco-rsc-client-build.json').clientManifestVersion")
curl -H "x-croco-rsc-client-manifest: $VERSION" http://127.0.0.1:4317/.rsc
```

`NODE_ENV=production` is required on both build and serve: a Flight payload
encoded by a React development build cannot be decoded by a production client
(React throws a version-mismatch page error and hydration silently fails). The
`build` and `serve` scripts set it for you. The server answers only for
`http://127.0.0.1:<port>`, so use that origin rather than `localhost`.

## Client-manifest check

```bash
VERSION=$(node -p "require('./dist/client/croco-rsc-client-build.json').clientManifestVersion")
curl -i -H "x-croco-rsc-client-manifest: $VERSION" http://127.0.0.1:4317/.rsc | grep 'x-croco-rsc-client-manifest'   # echoed version
curl -i -X GET -H 'x-croco-rsc-client-manifest: stale' http://127.0.0.1:4317/.rsc | head -n 1
# HTTP/1.1 400 — {"error":"RSC client manifest mismatch",...}
curl -i http://127.0.0.1:4317/.rsc | head -n 1
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
| baseline        | PDP + same deferred recommendation source/content + real Flight encoder/SSR/browser decoder                        |
| experiment      | `ExperimentRuntime` + `ExperimentDeliveryBridge`, immutable admitted supporting-copy decision                      |
| personalization | `loadPersonalizedFragments`, `InMemoryCacheStore`, shared public fragment and request-local private recommendation |
| combined        | Both integrations on the same PDP                                                                                  |

The fixture's **synthetic** `lab-user` cookie selects Alice or Bob. It is not an
authentication example. Final HTML and Flight are private/no-store; private values
and receipts never enter the shared fragment cache. The experiment measurement includes assignment/admission, the native
`ExperimentRegion` browser boundary and its display-exposure request. It does not
measure conversion delivery. It adds no allocator. Optional recommendation failure yields
an explicit unavailable region and diagnostic, leaving the real CTA usable. The
browser hydrates from the exact Flight bytes streamed into the document, rather
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
decoded/visible hero, browser LCP, decoded HTML/streamed Flight/JS/image bytes,
actual transfer bytes, requests, fragment source, hydration-ready time, visible
recommendation time and keyboard-click-to-next-paint latency. The shell hydrates
from the Flight rows that arrived with it, so hydration-ready time excludes
deferred-content waiting; that waiting shows up in recommendation time instead.
Click-to-next-paint is a **lab interaction measurement, not field INP**. Missing
measurements fail; they are never zero-filled. Timing deltas require identical
artifact, fixture, versions, user, viewport, network, CPU, cache mode and repetition.

The lab also injects a held blocking fetch, a slow optional source (which must
delay only the recommendation, never hydration), oversized valid JS and image responses,
a missing responsive image policy, an initial/hydrated snapshot discrepancy and private-content contamination. Each
must be rejected. Separate browser checks verify optional-source failure, Alice/Bob
isolation (Alice → Bob → Alice with no intervening cache reset, public-cache hits, and HTML/Flight private values), network-path origin rejection, mobile/desktop overflow, keyboard/ARIA behavior, no unexpected browser
errors, manifest/status handling, and, while the recommendation fetch is held,
that the shell hydrates without a second Flight request, the CTA answers the
keyboard and the experiment exposure is reported. After release, either a late
recommendation or a late failure (`/lab/resume?outcome=unavailable`) fills the
same UI while the CTA keeps its state and the hero keeps its geometry, and a
fresh decoded refresh follows.
The shared-private-cache negative control deliberately stores the first user’s private result in the process cache; the same user-switch checks must reject its HTML and Flight.
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
