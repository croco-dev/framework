# @croco/frontend-vite

## 0.0.4

### Patch Changes

- 8e15939: `crocoVitePlugin({ cloudflare: false })` no longer requires `@cloudflare/vite-plugin` at package import time, and the Cloudflare plugin is documented as an optional peer dependency for the default integration path. Missing default-path Cloudflare installs now surface as a Croco Problem diagnostic.
- fe0a955: Frontend Vite generated profiles now prove SPA browser builds and meta-vite generated app builds with documented optional Cloudflare peer diagnostics.
- 6d3f54a: Presentation package docs now describe `@croco/meta-vite` as the Croco-native SSR/RSC runtime, while retained Vike preset naming is marked as legacy compatibility for generated meta-vite profiles.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- ea92d63: Presentation and Cloudflare Worker packages now have generated-app smoke and API reference evidence for their beta runtime claims.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
