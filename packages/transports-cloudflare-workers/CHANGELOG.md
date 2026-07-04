# @croco/transports-cloudflare-workers

## 0.0.4

### Patch Changes

- c2b8e9e: - fix: document Workers type dependency contract
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- ea92d63: Presentation and Cloudflare Worker packages now have generated-app smoke and API reference evidence for their beta runtime claims.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 14bd9f8: - Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
  - Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
  - Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
- 0618b12: Runtime capability support now includes explicit filesystem, Node API, and request lifecycle flags for Node, Lambda, and Cloudflare Workers request contexts.
- 41ee87a: Expose a request-scoped `RuntimeContext` contract for Node, AWS Lambda, and Cloudflare Workers runtime metadata.
- 4cc1531: Forward Cloudflare Worker execution context through `toWorkersHandler` when `injectEnv` is enabled.
- Updated dependencies [4d8f094]
- Updated dependencies [6769a7f]
- Updated dependencies [51b0f14]
- Updated dependencies [a77425f]
- Updated dependencies [6148ed3]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [da861c8]
- Updated dependencies [e108899]
- Updated dependencies [c0c7215]
- Updated dependencies [42bc50e]
- Updated dependencies [9f7e769]
- Updated dependencies [000e999]
- Updated dependencies [8a85c6a]
- Updated dependencies [9556d22]
- Updated dependencies [f40eb63]
- Updated dependencies [b6449cc]
- Updated dependencies [d707a0c]
- Updated dependencies [58b689a]
- Updated dependencies [eeebc70]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [7442f1c]
- Updated dependencies [bc5594d]
  - @croco/transports-http@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/transports-http@0.0.3
