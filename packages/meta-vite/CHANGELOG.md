# @croco/meta-vite

## 0.1.0

### Minor Changes

- c9de124: Implement real React Flight RSC path (#2835): official `@vitejs/plugin-rsc`
  encoder in an isolated `react-server` child process, official
  `react-server-dom-webpack/client` decode plus `react-dom/server` HTML render in
  `RenderServer`, negotiated HTML vs Flight on one path with manifest-version
  diagnostics, explicit server-reference failure, per-call Server Action origin
  checks, and the Node production-build proof in `examples/rsc-node-example`.

  The client manifest version is now per client build: `crocoMetaVitePlugin`
  records the client build id in `dist/client/croco-rsc-client-build.json`,
  `resolveRscClientManifestVersion` composes it into the negotiated version, and
  `createRscBrowserFlightHeaders` lets a browser echo the version its document
  was rendered with. A Flight request carrying a different version is refused.

  The browser half of that handshake is exported from a new `@croco/meta-vite`
  subpath, `./rsc/browser`: the package root is a server entry (it pulls in Node
  builtins through the render and build modules), so a client bundle cannot
  import it. `createRscBrowserFlightHeaders`, `readRscClientManifestVersion`, and
  the manifest constants are reachable from `./rsc/browser`; the implementation
  stays owned by the root module, so both paths share one contract.

  Problem codes `meta-vite/rsc-client-manifest-mismatch`,
  `meta-vite/rsc-client-reference-missing`, `meta-vite/rsc-flight-not-acceptable`,
  `meta-vite/rsc-server-reference-unsupported`, `meta-vite/rsc-flight-encode-failed`,
  `meta-vite/rsc-flight-encode-timeout`, `meta-vite/rsc-flight-encode-aborted`,
  `meta-vite/rsc-encoder-entry-invalid-input`, `meta-vite/rsc-client-build-id-invalid`,
  `meta-vite/server-action-duplicate-registration` and
  `meta-vite/server-action-forbidden-origin` get recovery metadata in the problem
  registry, replacing the per-category defaults for these RSC and Server Action
  codes. `meta-vite/rsc-flight-context-unsupported` is new: the isolated encoder
  renders in a child process over a JSON pipe, so a route that would need host
  context values cannot be served and is refused instead of rendering them as
  `undefined`. It carries recovery metadata that states this and marks it
  `not-retryable`.

  A 5xx Problem answered from the render server now returns its code and a fixed
  title instead of its message: the encoder's messages carry route, platform, and
  timeout detail that the registry holds `operator-only`, so that detail goes to
  the log while the response stays redacted.

  `@croco/frontend-react` takes a patch: its development `react` and `react-dom`
  versions move to the pinned 19.2.6 so the workspace hoists a single React
  resolution against the new peers. `@croco/meta-vite` also records
  `"./package.json"` in its workspace exports map, which keeps the isolated
  encoder's package-manifest fallback resolvable now that the map exists.

  Three corrections to the Flight response path that this review round surfaced:
  - The Flight response no longer commits `200` before the encoder proved it can
    render. A server component that fails to import errors on the stream after
    it was handed back, so previously a client received a success status carrying
    a broken body. The first row is read while the status can still change, then
    relayed with the rest; an encoder that closes without writing a row is
    refused too.
  - The HTML wrapper is read on consumer demand instead of being drained into the
    internal queue by a `start()` loop, so a slow client no longer holds a whole
    document in memory per in-flight request.
  - The meta-tag fallback returns the attribute value the HTML parser already
    decoded, instead of decoding it a second time and mangling a version whose
    own text contains an entity-looking sequence.

  A later round on the same path:
  - Flight responses declare `Vary: Accept, x-croco-rsc-client-manifest`, so a
    shared cache cannot serve a Flight body to a document request or reuse one
    build's payload for another.
  - The browser entry checks the response status before decoding, so a stale
    document answered with a Problem body reports the mismatch instead of
    failing inside the Flight decoder and leaving the page silently stale.
  - A late Flight stream failure — an encoder timeout or an output cap reached
    after the shell row — now releases the reader and is reported to the operator
    instead of silently ending the response.
  - `RscManifestElement` is exported so the document handshake's `getAttribute`
    member is named and documented as a method rather than flattened into a
    property.

- 92bf624: Shell-first streaming SSR: SSR pages with declared deferred regions stream the critical shell first and resolve regions later through React Suspense. Shell status decisions (`resolveShell`) commit before header flush; after-flush region errors keep a safe fallback without status rewrites or stack exposure. Request cancellation propagates through the per-request region signal, and Lambda buffers shell-first pages before returning. SSR pages with regions now report `streaming-response` in the route manifest.
- 66ebeeb: feat(cache-core,meta-vite): add personalized SSR fragment cache with public/variant/private zones
- 4b63c55: Generate deterministic sitemaps from revision-pinned public resource sources, publish complete generations through a shared POSIX coordinator and optional StorageProvider, and inspect exclusions through authorized administrator endpoints.
- c8e39b5: Render repository-backed public pages with matching publication statuses and initial metadata, and inspect their actual responses through registered CLI and admin targets.

### Patch Changes

- a6e5d99: Convert non-form-data server action POST bodies to `meta-vite/server-action-invalid-content-type` (415) problem+json instead of propagating the raw `request.formData()` TypeError. Malformed bodies that arrive with a form content type now surface as `meta-vite/server-action-malformed-body` (400).
- ffebb2d: - fix(meta-vite): propagate API handler exceptions instead of swallowing as 404
- 34892a3: - Keep published consumer typechecks reproducible with PostCSS 8.5.28.
- b278729: - fix: block critical test tooling advisories
- 696c76b: Report cached HTML from `createIsrHandler` with `source: 'cache'` while preserving `source: 'render'` for cache misses.
- a3d4ad6: Validate large sitemap URL sets without allocating per-character arrays or repeatedly serializing canonical identity keys, preserving public URL filtering and exact uncompressed XML size limits.
- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- f406d82: Dispatch registered Unicode page paths and server action names through their URL representations while preserving ASCII routes and duplicate detection.
- 24f2385: Report the legacy `rsc` route as buffered React SSR rather than React Flight or progressive streaming. Keep requested mode and runtime requirements intact, and reject explicitly required page capabilities that the implementation cannot provide. Existing render payloads, status codes, and SSR error observation remain unchanged; consumers relying on the previous capability claims must treat Flight and streaming as unsupported.
- d99ede2: Compose REST RPC and Meta Vite server actions into one deterministic frontend action manifest while rejecting schema mismatches and conflicting duplicate action identities before output replacement.
- 8522b0c: Keep default package tests deterministic while exposing integration, published-package, and live-resource verification through explicit test lanes.
- c80252f: Preserve API Gateway cookies and payload format 1.0 query parameters in Lambda page and API requests.
- 02b2e26: Reject API routes outside `/api` and `/api/` during registration, route manifest creation, and fetch handler creation with a stable diagnostic instead of advertising unreachable dispatch capabilities.
- 7ab43e0: SSR render failures now log the original error and route path on the server while preserving the generic 500 HTML response.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 47a4fd9: Require `react-dom` as a peer for the packed root entrypoint because it imports `react-dom/server` at runtime.
- 7c006af: Preserve repeated FormData field values as ordered arrays during server action validation while keeping single-value fields scalar.
- e90e7bc: Enforce deterministic compatibility snapshots for every published export subpath, including conditional code targets and manifest-only assets.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- 657d8fc: Register CROCO_META_VITE_SSG_OUTPUT_CONFLICT with build-time recovery instructions. Reject conflicting SSG output paths before rendering instead of returning HTML artifacts that overwrite one another.
- 5e1c956: Preserve buffered Lambda response status, headers, cookies and body through API Gateway v1/v2 serialization. Meta-vite Lambda callbacks now return LambdaProxyResponse instead of Web Response: use statusCode and body, decoding base64 when isBase64Encoded is true. Reuse the HTTP transport response converter through @croco/transports-http/lambda-response; body read failures reject the invocation.
- d1e374a: Reject invalid page route components, render modes, and revalidation intervals with route paths and stable diagnostic codes before compiling routes or emitting manifests. Preserve zero and fractional revalidation intervals.
- 4fdae06: Keep range requests and partial responses out of the shared ISR cache so full requests receive complete bodies.
- e87ff1a: Escape HTML-sensitive characters in embedded RSC Flight payloads so script-closing content cannot terminate the payload tag.
- 85b2665: Server action Problem responses now redact operator-only details and private extensions while preserving public validation and routing fields. The published Problem code registry now points to the updated server action source locations.
- e07a323: Meta-Vite and generated Meta-Vite applications now require Vite `>=6.4.3 <7`, excluding the Windows
  development-server filesystem deny bypass fixed in Vite 6.4.3.
- 9402946: Dispatch nested API routes to the most specific matching path regardless of registration order.
- 79a3835: Await asynchronous server action input validation so valid refinements reach the handler and invalid inputs retain their validation Problem response.
- 51f4775: Restore Lambda request origins regardless of Host and X-Forwarded-Proto header name casing.
- 30ec6d6: Render explicit head().ogTitle values as escaped og:title metadata in HTML shells while preserving the document title and omitting the tag when no sharing title is provided.
- Updated dependencies [5503326]
- Updated dependencies [8214d67]
- Updated dependencies [12e51a3]
- Updated dependencies [029130d]
- Updated dependencies [839c7d0]
- Updated dependencies [87471c8]
- Updated dependencies [8bc3ca5]
- Updated dependencies [a661a90]
- Updated dependencies [d9affdf]
- Updated dependencies [edd8297]
- Updated dependencies [a6e5d99]
- Updated dependencies [4d32e65]
- Updated dependencies [d595f1a]
- Updated dependencies [0df6df9]
- Updated dependencies [7665cbd]
- Updated dependencies [7d6ec6b]
- Updated dependencies [f305867]
- Updated dependencies [eb80ac6]
- Updated dependencies [9684c00]
- Updated dependencies [c9de124]
- Updated dependencies [66ebeeb]
- Updated dependencies [31a6ed5]
- Updated dependencies [efe301f]
- Updated dependencies [93e89b7]
- Updated dependencies [ec0a465]
- Updated dependencies [66c18a7]
- Updated dependencies [b28e05b]
- Updated dependencies [f339ef9]
- Updated dependencies [1a3f9cb]
- Updated dependencies [9c3d151]
- Updated dependencies [85634b8]
- Updated dependencies [5a7fe34]
- Updated dependencies [78f08f7]
- Updated dependencies [0645e1b]
- Updated dependencies [02eeb40]
- Updated dependencies [a6d9468]
- Updated dependencies [dcf28f8]
- Updated dependencies [4b6e723]
- Updated dependencies [a08f36c]
- Updated dependencies [3783f28]
- Updated dependencies [38cba9c]
- Updated dependencies [f3709a6]
- Updated dependencies [98001e1]
- Updated dependencies [b278729]
- Updated dependencies [bebc2f6]
- Updated dependencies [6795b4d]
- Updated dependencies [7390b1b]
- Updated dependencies [28bd12e]
- Updated dependencies [8bb215f]
- Updated dependencies [fe51253]
- Updated dependencies [c3de6cc]
- Updated dependencies [868ea09]
- Updated dependencies [84a05bd]
- Updated dependencies [c1d0ed0]
- Updated dependencies [e0c11de]
- Updated dependencies [98ba459]
- Updated dependencies [d7b2bde]
- Updated dependencies [319d43e]
- Updated dependencies [269d9df]
- Updated dependencies [1380ce5]
- Updated dependencies [64af41f]
- Updated dependencies [7cdfcae]
- Updated dependencies [c91a72b]
- Updated dependencies [30bad55]
- Updated dependencies [121b830]
- Updated dependencies [0e658fc]
- Updated dependencies [cb36e68]
- Updated dependencies [34b6c3d]
- Updated dependencies [3b99ee8]
- Updated dependencies [cb61f2e]
- Updated dependencies [13cfab4]
- Updated dependencies [f05e38e]
- Updated dependencies [ade3461]
- Updated dependencies [e9e2d49]
- Updated dependencies [d0ed66c]
- Updated dependencies [9404839]
- Updated dependencies [2d74ff8]
- Updated dependencies [b07ae3a]
- Updated dependencies [5d08b1b]
- Updated dependencies [99ace13]
- Updated dependencies [08cfa9b]
- Updated dependencies [1084825]
- Updated dependencies [24f2385]
- Updated dependencies [3434d4b]
- Updated dependencies [7ebbb56]
- Updated dependencies [fb1faf9]
- Updated dependencies [26f4b9e]
- Updated dependencies [88c6ce1]
- Updated dependencies [7c632bb]
- Updated dependencies [772a244]
- Updated dependencies [2bbb09f]
- Updated dependencies [00bfe50]
- Updated dependencies [d9ab40a]
- Updated dependencies [1d12013]
- Updated dependencies [50c8c7d]
- Updated dependencies [dda0a50]
- Updated dependencies [939af32]
- Updated dependencies [7dc3a10]
- Updated dependencies [3853d82]
- Updated dependencies [935d29f]
- Updated dependencies [583588d]
- Updated dependencies [da978b0]
- Updated dependencies [718ee7d]
- Updated dependencies [f438532]
- Updated dependencies [527475f]
- Updated dependencies [2cc5438]
- Updated dependencies [0b5a8fa]
- Updated dependencies [c008825]
- Updated dependencies [98fcaed]
- Updated dependencies [f647df2]
- Updated dependencies [d1a03e6]
- Updated dependencies [3342494]
- Updated dependencies [77794c4]
- Updated dependencies [d99ede2]
- Updated dependencies [34114fd]
- Updated dependencies [50db523]
- Updated dependencies [5fc43c0]
- Updated dependencies [13f74d8]
- Updated dependencies [d2e17ce]
- Updated dependencies [7df16bb]
- Updated dependencies [014e7dd]
- Updated dependencies [ea742a4]
- Updated dependencies [eb8003d]
- Updated dependencies [7e46a3d]
- Updated dependencies [9ed442c]
- Updated dependencies [ba8b08c]
- Updated dependencies [2f157b4]
- Updated dependencies [0fa2546]
- Updated dependencies [077bb26]
- Updated dependencies [91e7bb6]
- Updated dependencies [0584573]
- Updated dependencies [500c048]
- Updated dependencies [c9c1c1d]
- Updated dependencies [543eda3]
- Updated dependencies [09c48b3]
- Updated dependencies [fd16580]
- Updated dependencies [6aeb0b0]
- Updated dependencies [2973efe]
- Updated dependencies [daef820]
- Updated dependencies [1f6522c]
- Updated dependencies [9b997bb]
- Updated dependencies [6d81e46]
- Updated dependencies [5d620c2]
- Updated dependencies [ec75eb4]
- Updated dependencies [101a7f1]
- Updated dependencies [b7f9b68]
- Updated dependencies [7aabe26]
- Updated dependencies [3648511]
- Updated dependencies [dda0a50]
- Updated dependencies [15e39cc]
- Updated dependencies [03ea9aa]
- Updated dependencies [7d248c5]
- Updated dependencies [00ac668]
- Updated dependencies [9b379dd]
- Updated dependencies [ba1974d]
- Updated dependencies [f11142a]
- Updated dependencies [bef753f]
- Updated dependencies [04ea69c]
- Updated dependencies [558c255]
- Updated dependencies [96b6b80]
- Updated dependencies [ab4453f]
- Updated dependencies [8522b0c]
- Updated dependencies [be7408f]
- Updated dependencies [969d87e]
- Updated dependencies [6fa6843]
- Updated dependencies [b875cea]
- Updated dependencies [6069742]
- Updated dependencies [7d9c92b]
- Updated dependencies [148a35f]
- Updated dependencies [210015b]
- Updated dependencies [06b597e]
- Updated dependencies [de9912a]
- Updated dependencies [2e21cb0]
- Updated dependencies [1255323]
- Updated dependencies [bc338cc]
- Updated dependencies [734c41b]
- Updated dependencies [4d3b429]
- Updated dependencies [f445c2d]
- Updated dependencies [2724540]
- Updated dependencies [1216b88]
- Updated dependencies [0d662c6]
- Updated dependencies [a513c78]
- Updated dependencies [b91d384]
- Updated dependencies [ba6ba75]
- Updated dependencies [1581edc]
- Updated dependencies [da23725]
- Updated dependencies [05c9c45]
- Updated dependencies [a4eacbf]
- Updated dependencies [76be188]
- Updated dependencies [fd6ba57]
- Updated dependencies [80ddb00]
- Updated dependencies [2bcfa27]
- Updated dependencies [1989ed4]
- Updated dependencies [2cd1d14]
- Updated dependencies [d52f81f]
- Updated dependencies [849f645]
- Updated dependencies [b228e78]
- Updated dependencies [eed5e70]
- Updated dependencies [10f3601]
- Updated dependencies [bf62995]
- Updated dependencies [5dac3cc]
- Updated dependencies [3bb5093]
- Updated dependencies [6f8080b]
- Updated dependencies [e039e2d]
- Updated dependencies [976a916]
- Updated dependencies [c30879a]
- Updated dependencies [26bcc38]
- Updated dependencies [0b5e89b]
- Updated dependencies [afb8544]
- Updated dependencies [e03bd40]
- Updated dependencies [e5aee59]
- Updated dependencies [7caa3ea]
- Updated dependencies [54f61ee]
- Updated dependencies [3e29376]
- Updated dependencies [1786455]
- Updated dependencies [68eb95a]
- Updated dependencies [98f7987]
- Updated dependencies [3d9e585]
- Updated dependencies [37dab98]
- Updated dependencies [00ec1c5]
- Updated dependencies [02b2e26]
- Updated dependencies [225e48a]
- Updated dependencies [538ab3d]
- Updated dependencies [a4a5a49]
- Updated dependencies [17c8730]
- Updated dependencies [9a03a84]
- Updated dependencies [0ee816f]
- Updated dependencies [67e0cbe]
- Updated dependencies [163b65c]
- Updated dependencies [e3bb85e]
- Updated dependencies [6a60235]
- Updated dependencies [fb10b5f]
- Updated dependencies [bdf13e1]
- Updated dependencies [4a15ff9]
- Updated dependencies [a7df589]
- Updated dependencies [71ea304]
- Updated dependencies [8c2b316]
- Updated dependencies [d975ce5]
- Updated dependencies [986ce2d]
- Updated dependencies [8630cf3]
- Updated dependencies [b175b28]
- Updated dependencies [31636bb]
- Updated dependencies [f92404b]
- Updated dependencies [44fb02d]
- Updated dependencies [1c843a5]
- Updated dependencies [c1dc054]
- Updated dependencies [a8d733b]
- Updated dependencies [2a6e12c]
- Updated dependencies [20cb828]
- Updated dependencies [796290f]
- Updated dependencies [efb33f9]
- Updated dependencies [1d935c2]
- Updated dependencies [157089a]
- Updated dependencies [47b942b]
- Updated dependencies [a458c5c]
- Updated dependencies [3ae15ed]
- Updated dependencies [e90e7bc]
- Updated dependencies [4b63c55]
- Updated dependencies [c8e39b5]
- Updated dependencies [5d54fb4]
- Updated dependencies [78e8e81]
- Updated dependencies [19bdcd1]
- Updated dependencies [16ff048]
- Updated dependencies [4c2a077]
- Updated dependencies [185a67d]
- Updated dependencies [657d8fc]
- Updated dependencies [3f99747]
- Updated dependencies [5e1c956]
- Updated dependencies [6aaafc8]
- Updated dependencies [badfb5c]
- Updated dependencies [b8ce34d]
- Updated dependencies [464af89]
- Updated dependencies [a2353be]
- Updated dependencies [1910ff9]
- Updated dependencies [affa795]
- Updated dependencies [6230b8a]
- Updated dependencies [c18f79a]
- Updated dependencies [bd3bf6f]
- Updated dependencies [5584cd6]
- Updated dependencies [223bbb3]
- Updated dependencies [72fbcd0]
- Updated dependencies [f2798d2]
- Updated dependencies [fb810a9]
- Updated dependencies [c7299d2]
- Updated dependencies [0530556]
- Updated dependencies [350833d]
- Updated dependencies [63ee9fc]
- Updated dependencies [e745cc9]
- Updated dependencies [049b25e]
- Updated dependencies [1884ceb]
- Updated dependencies [7328ec4]
- Updated dependencies [d77aedc]
- Updated dependencies [92f606b]
- Updated dependencies [b07fb90]
- Updated dependencies [56f440b]
- Updated dependencies [f5503fd]
- Updated dependencies [eab516f]
- Updated dependencies [f2094bc]
- Updated dependencies [c57ba6e]
- Updated dependencies [e9db5a8]
- Updated dependencies [4505d13]
- Updated dependencies [c5eee6e]
- Updated dependencies [f24f196]
- Updated dependencies [cc8106d]
- Updated dependencies [90133b3]
- Updated dependencies [f766166]
- Updated dependencies [ce1a95b]
- Updated dependencies [a2760e3]
- Updated dependencies [10fc7b4]
- Updated dependencies [753b3cd]
- Updated dependencies [f17460a]
- Updated dependencies [e97f694]
- Updated dependencies [ab51ace]
- Updated dependencies [a846f7e]
- Updated dependencies [1e313a1]
- Updated dependencies [26fb699]
- Updated dependencies [5575357]
- Updated dependencies [524f00c]
- Updated dependencies [c11a9b4]
- Updated dependencies [13940c4]
- Updated dependencies [2678364]
- Updated dependencies [037c3c4]
- Updated dependencies [5e64d94]
- Updated dependencies [344995f]
- Updated dependencies [c0c9679]
- Updated dependencies [286a5ad]
- Updated dependencies [918a960]
- Updated dependencies [44c16c9]
- Updated dependencies [85b2665]
- Updated dependencies [7f7ccee]
- Updated dependencies [25bfb06]
- Updated dependencies [5feb5b8]
- Updated dependencies [f0f20c2]
- Updated dependencies [605d41d]
- Updated dependencies [a34879e]
- Updated dependencies [6234fdf]
- Updated dependencies [115ed96]
- Updated dependencies [952f2f0]
- Updated dependencies [a8bc534]
- Updated dependencies [1a209ad]
- Updated dependencies [d1198c2]
- Updated dependencies [2742cbc]
- Updated dependencies [555d5fe]
- Updated dependencies [95cedd9]
- Updated dependencies [13c98eb]
- Updated dependencies [847ecbf]
- Updated dependencies [80d86ff]
- Updated dependencies [bd95a2c]
- Updated dependencies [422326b]
- Updated dependencies [6f3c5b4]
- Updated dependencies [9163f70]
- Updated dependencies [4c5f2b6]
- Updated dependencies [01ed4e5]
- Updated dependencies [fa8eea4]
- Updated dependencies [be64cc8]
- Updated dependencies [ae4a089]
- Updated dependencies [ac94fc6]
- Updated dependencies [3a9e51d]
- Updated dependencies [0026f76]
- Updated dependencies [f22f68f]
- Updated dependencies [c5fb714]
- Updated dependencies [2c68e9c]
- Updated dependencies [86eb935]
- Updated dependencies [fccf65b]
- Updated dependencies [6ff55f8]
- Updated dependencies [65f3fdc]
- Updated dependencies [da7d9e0]
- Updated dependencies [0f85719]
- Updated dependencies [84fa44f]
- Updated dependencies [3cca753]
- Updated dependencies [4fe1d1e]
- Updated dependencies [28c3ab5]
- Updated dependencies [df1124c]
- Updated dependencies [7667e26]
- Updated dependencies [80f4ce9]
- Updated dependencies [0197196]
- Updated dependencies [95be142]
- Updated dependencies [2f21a14]
- Updated dependencies [dd4c235]
- Updated dependencies [e36d9f3]
- Updated dependencies [6754896]
- Updated dependencies [5226e2e]
- Updated dependencies [c1ffad6]
- Updated dependencies [97ba64a]
- Updated dependencies [6542499]
- Updated dependencies [d808f9d]
- Updated dependencies [ff35df4]
- Updated dependencies [3e2e6f7]
- Updated dependencies [51d2d51]
- Updated dependencies [7b1505b]
- Updated dependencies [b0eb7c7]
- Updated dependencies [8c1acbd]
- Updated dependencies [683bd47]
- Updated dependencies [99da854]
- Updated dependencies [25f2035]
- Updated dependencies [f9869f1]
- Updated dependencies [c80ce21]
- Updated dependencies [589087a]
- Updated dependencies [3aec14e]
- Updated dependencies [b8fdd47]
- Updated dependencies [9b96858]
- Updated dependencies [ae125e4]
- Updated dependencies [b242060]
- Updated dependencies [1b201e5]
- Updated dependencies [713cf3b]
- Updated dependencies [8a1dad8]
- Updated dependencies [3bd0a5a]
- Updated dependencies [abb5e10]
- Updated dependencies [facdc89]
- Updated dependencies [87e0994]
- Updated dependencies [87a375e]
- Updated dependencies [4afb5cf]
- Updated dependencies [62885fe]
- Updated dependencies [525847a]
- Updated dependencies [b65ed66]
- Updated dependencies [76e734f]
- Updated dependencies [7e88b45]
- Updated dependencies [7653376]
- Updated dependencies [70fd27f]
- Updated dependencies [8e19e13]
- Updated dependencies [6d10475]
- Updated dependencies [f090217]
- Updated dependencies [0e0a46c]
- Updated dependencies [a144d94]
- Updated dependencies [973b270]
- Updated dependencies [f486287]
- Updated dependencies [913c441]
- Updated dependencies [47c98a4]
- Updated dependencies [377c684]
  - @croco/problems-core@1.0.0
  - @croco/transports-http@0.1.0
  - @croco/storage-core@1.0.0
  - @croco/cache-core@1.0.0
  - @croco/presentation-preset@0.1.0
  - @croco/seo-core@0.1.0

## 0.0.4

### Patch Changes

- dc6723d: Expose a shared frontend action manifest so generated RPC clients and meta-vite server actions publish inspectable action contracts with drift checks.
- 1cd17aa: Server actions can now use scoped registries with reset and unregister cleanup paths for tests, HMR, and multi-app runtimes while preserving the global registry API.
- 1e60ada: Meta fetch handlers now return 405 Method Not Allowed with an Allow header when API route paths exist but do not support the request method.
- ac40099: Expose ISR runtime support diagnostics and cover durable Node/Lambda ISR plus Workers durable cache boundaries in package smoke tests.
- b257dc8: Meta fetch handlers now return fresh 404 Response instances for API and page misses so repeated body reads do not fail after an earlier miss.
- 9f0f082: RouteRegistry now rejects duplicate page paths at registration time instead of letting ambiguous page routes accumulate.
- 81eb35b: Expose the Redis ISR adapter through the published `@croco/meta-vite/isr/adapters` entrypoint and declare its optional `ioredis` peer contract while keeping root server-action types usable without Redis.
- 0fdb088: Meta Vite apps can now emit deterministic route manifests for page routes, API routes, server actions, component references, revalidation, and runtime capability requirements.
- 72eed06: Pass RuntimeContext through API route dispatch so server action HTTP handlers can observe provider context.
- 7bf4452: Server action failures now return a Problem-backed action result contract with stable kinds for missing actions, invalid paths, validation errors, and domain Problems.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [3f59af3]
- Updated dependencies [305eed7]
- Updated dependencies [444a829]
- Updated dependencies [dc6723d]
- Updated dependencies [fe0a955]
- Updated dependencies [cb11e66]
- Updated dependencies [0ab39c6]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
  - @croco/cache-core@0.0.4
  - @croco/presentation-preset@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/cache-core@0.0.3
  - @croco/presentation-preset@0.0.3
