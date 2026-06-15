# @croco/transports-cloudflare-workers

## 0.0.4

### Patch Changes

- c2b8e9e: - fix: document Workers type dependency contract
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 41ee87a: Expose a request-scoped `RuntimeContext` contract for Node, AWS Lambda, and Cloudflare Workers runtime metadata.
- 4cc1531: Forward Cloudflare Worker execution context through `toWorkersHandler` when `injectEnv` is enabled.
- Updated dependencies [51b0f14]
- Updated dependencies [da861c8]
- Updated dependencies [c0c7215]
- Updated dependencies [42bc50e]
- Updated dependencies [8a85c6a]
- Updated dependencies [d707a0c]
- Updated dependencies [41ee87a]
- Updated dependencies [7442f1c]
- Updated dependencies [bc5594d]
  - @croco/transports-http@1.0.0

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/transports-http@0.0.3
