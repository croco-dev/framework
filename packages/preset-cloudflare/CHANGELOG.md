# @croco/preset-cloudflare

## 0.1.0

### Minor Changes

- 7d248c5: Expose host, transport, and build-target composition as separate runtime metadata, bind host callbacks
  to their owning application scope, preserve the legacy Cloudflare handler context, and teach generated
  apps and presentation adapters to use explicit host and build-target entry points. Generated Lambda and
  Cloudflare SaaS apps now advertise commands that validate their actual deployment targets, including a
  Wrangler configuration with explicit Node.js compatibility for the generated Worker composition. Raw
  Hono callbacks must explicitly select raw-Hono dispatch when using the canonical Cloudflare host.

  Generated SaaS hosts await provider initialization and leave telemetry shutdown to the application
  runtime. Lambda and Workers host artifacts do not enable their documentation-only SaaS provider
  composition; invoking those profiles still reports `CROCO_SAAS_PROFILE_RUNTIME_UNAVAILABLE`.

- d5b1703: Run the Cloudflare SaaS profile as an env-owned native Worker bootstrap with explicit graph verification and unavailable SaaS capability diagnostics. Health checks prove only local bootstrap readiness; full SaaS providers and real-service certification remain unavailable.

### Patch Changes

- b278729: - fix: block critical test tooling advisories
- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- 17c8730: Resolve ESM and CommonJS consumers to declaration files matching each published implementation format.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 9577c5a: Pass each Worker request's abort signal through the default runtime context and preserve the app receiver during fetch, so
  Croco applications can validate runtime capabilities and observe request cancellation.
- e90e7bc: Enforce deterministic compatibility snapshots for every published export subpath, including conditional code targets and manifest-only assets.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- bd3bf6f: Serve prepared GraphQL query/mutation schemas through a fetch-only entrypoint on Workers with nodejs_compat, reuse runtime guards and Problem mapping without the schema compiler, and verify native GraphQL/tRPC requests in local workerd. Root and fetch guards retain shared role metadata and DI token identity in both ESM and CommonJS packages. Subscription schemas fail explicitly; deployment certification remains separate.
- 6cbf056: Require explicit raw mode for legacy Hono Worker callbacks and accept current Hono execution contexts without casts. Raw forwarding preserves bindings and execution context identity; Croco runtime dispatch remains the default.
- Updated dependencies [8214d67]
- Updated dependencies [12e51a3]
- Updated dependencies [4d32e65]
- Updated dependencies [d595f1a]
- Updated dependencies [31a6ed5]
- Updated dependencies [93e89b7]
- Updated dependencies [b28e05b]
- Updated dependencies [f339ef9]
- Updated dependencies [1a3f9cb]
- Updated dependencies [5a7fe34]
- Updated dependencies [a6d9468]
- Updated dependencies [a08f36c]
- Updated dependencies [4ca14ab]
- Updated dependencies [38cba9c]
- Updated dependencies [f3709a6]
- Updated dependencies [98001e1]
- Updated dependencies [b278729]
- Updated dependencies [7008727]
- Updated dependencies [bebc2f6]
- Updated dependencies [8bb215f]
- Updated dependencies [c3de6cc]
- Updated dependencies [868ea09]
- Updated dependencies [98ba459]
- Updated dependencies [7cdfcae]
- Updated dependencies [cb36e68]
- Updated dependencies [9404839]
- Updated dependencies [26f4b9e]
- Updated dependencies [00bfe50]
- Updated dependencies [d9ab40a]
- Updated dependencies [718ee7d]
- Updated dependencies [2cc5438]
- Updated dependencies [3342494]
- Updated dependencies [da9925f]
- Updated dependencies [13f74d8]
- Updated dependencies [d2e17ce]
- Updated dependencies [7df16bb]
- Updated dependencies [ea742a4]
- Updated dependencies [eb8003d]
- Updated dependencies [0fa2546]
- Updated dependencies [008f3f0]
- Updated dependencies [500c048]
- Updated dependencies [543eda3]
- Updated dependencies [6489abb]
- Updated dependencies [6aeb0b0]
- Updated dependencies [3648511]
- Updated dependencies [dda0a50]
- Updated dependencies [7d248c5]
- Updated dependencies [f11142a]
- Updated dependencies [558c255]
- Updated dependencies [ab4453f]
- Updated dependencies [8522b0c]
- Updated dependencies [be7408f]
- Updated dependencies [b875cea]
- Updated dependencies [06b597e]
- Updated dependencies [16cc286]
- Updated dependencies [734c41b]
- Updated dependencies [a513c78]
- Updated dependencies [ba6ba75]
- Updated dependencies [a4eacbf]
- Updated dependencies [80ddb00]
- Updated dependencies [2bcfa27]
- Updated dependencies [1989ed4]
- Updated dependencies [2cd1d14]
- Updated dependencies [d52f81f]
- Updated dependencies [849f645]
- Updated dependencies [b228e78]
- Updated dependencies [eed5e70]
- Updated dependencies [c30879a]
- Updated dependencies [cfdc20a]
- Updated dependencies [afb8544]
- Updated dependencies [e03bd40]
- Updated dependencies [e5aee59]
- Updated dependencies [7caa3ea]
- Updated dependencies [54f61ee]
- Updated dependencies [3e29376]
- Updated dependencies [1786455]
- Updated dependencies [68eb95a]
- Updated dependencies [17c8730]
- Updated dependencies [0ee816f]
- Updated dependencies [67e0cbe]
- Updated dependencies [e3bb85e]
- Updated dependencies [4a15ff9]
- Updated dependencies [1c843a5]
- Updated dependencies [c1dc054]
- Updated dependencies [45882f1]
- Updated dependencies [a8d733b]
- Updated dependencies [f0c328e]
- Updated dependencies [6bac6de]
- Updated dependencies [20cb828]
- Updated dependencies [efb33f9]
- Updated dependencies [1d935c2]
- Updated dependencies [157089a]
- Updated dependencies [5d54fb4]
- Updated dependencies [55b4c7a]
- Updated dependencies [5e1c956]
- Updated dependencies [464af89]
- Updated dependencies [1910ff9]
- Updated dependencies [5584cd6]
- Updated dependencies [f2798d2]
- Updated dependencies [e745cc9]
- Updated dependencies [7328ec4]
- Updated dependencies [d77aedc]
- Updated dependencies [f2094bc]
- Updated dependencies [e9db5a8]
- Updated dependencies [c5eee6e]
- Updated dependencies [90133b3]
- Updated dependencies [0efaa4f]
- Updated dependencies [a2760e3]
- Updated dependencies [e97f694]
- Updated dependencies [ab51ace]
- Updated dependencies [5575357]
- Updated dependencies [524f00c]
- Updated dependencies [c11a9b4]
- Updated dependencies [8aa72a1]
- Updated dependencies [5e64d94]
- Updated dependencies [918a960]
- Updated dependencies [f141c18]
- Updated dependencies [7f7ccee]
- Updated dependencies [a8bc534]
- Updated dependencies [1a209ad]
- Updated dependencies [13c98eb]
- Updated dependencies [f22f68f]
- Updated dependencies [2c68e9c]
- Updated dependencies [0f85719]
- Updated dependencies [4fe1d1e]
- Updated dependencies [48d775c]
- Updated dependencies [7667e26]
- Updated dependencies [f9193be]
- Updated dependencies [dd4c235]
- Updated dependencies [6754896]
- Updated dependencies [d808f9d]
- Updated dependencies [8c1acbd]
- Updated dependencies [99da854]
- Updated dependencies [ae125e4]
- Updated dependencies [76e734f]
- Updated dependencies [377c684]
  - @croco/transports-http@0.1.0
  - @croco/framework-context@0.1.0
  - @croco/framework-module@0.1.0
  - @croco/framework-preset@0.1.0

## 0.0.4

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- 5f07310: Forward Cloudflare Worker env and execution context arguments to the app fetch handler.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 14bd9f8: - Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
  - Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
  - Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
- 0618b12: Runtime capability support now includes explicit filesystem, Node API, and request lifecycle flags for Node, Lambda, and Cloudflare Workers request contexts.
- 41ee87a: Expose a request-scoped `RuntimeContext` contract for Node, AWS Lambda, and Cloudflare Workers runtime metadata.
- Updated dependencies [d281518]
- Updated dependencies [d707a0c]
  - @croco/framework-preset@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
  - @croco/framework-preset@0.0.3
