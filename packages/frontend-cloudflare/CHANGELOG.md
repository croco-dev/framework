# @croco/frontend-cloudflare

## 0.1.0

### Minor Changes

- f81bcf7: `@croco/frontend-cloudflare` now has beta Worker SSR evidence for service-binding API routing, assets fallback, streaming `Response` preservation, Cloudflare RuntimeContext propagation, and deterministic failure behavior. The generated Cloudflare meta-vite fullstack profile now exports a real Worker SSR handler and smoke-tests the Worker boundary.

### Patch Changes

- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- ea92d63: Presentation and Cloudflare Worker packages now have generated-app smoke and API reference evidence for their beta runtime claims.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [dc6723d]
- Updated dependencies [1cd17aa]
- Updated dependencies [1e60ada]
- Updated dependencies [ac40099]
- Updated dependencies [b257dc8]
- Updated dependencies [9f0f082]
- Updated dependencies [81eb35b]
- Updated dependencies [0fdb088]
- Updated dependencies [72eed06]
- Updated dependencies [7bf4452]
- Updated dependencies [40b024d]
- Updated dependencies [d707a0c]
  - @croco/meta-vite@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
  - @croco/meta-vite@0.0.3
