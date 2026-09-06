# @croco/preset-cloudflare

## 0.0.5

### Patch Changes

- b278729: - fix: block critical test tooling advisories
- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 9577c5a: Pass each Worker request's abort signal through the default runtime context and preserve the app receiver during fetch, so
  Croco applications can validate runtime capabilities and observe request cancellation.
- e90e7bc: Enforce deterministic compatibility snapshots for every published export subpath, including conditional code targets and manifest-only assets.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- Updated dependencies [b278729]
- Updated dependencies [7cdfcae]
- Updated dependencies [67e0cbe]
- Updated dependencies [5d54fb4]
- Updated dependencies [48d775c]
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
