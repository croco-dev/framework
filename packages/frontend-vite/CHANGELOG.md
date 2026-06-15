# @croco/frontend-vite

## 0.0.4

### Patch Changes

- 8e15939: `crocoVitePlugin({ cloudflare: false })` no longer requires `@cloudflare/vite-plugin` at package import time, and the Cloudflare plugin is documented as an optional peer dependency for the default integration path. Missing default-path Cloudflare installs now surface as a Croco Problem diagnostic.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
