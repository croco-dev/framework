# @croco/preset-node

## 0.0.4

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- 6c0bfda: Preset factories no longer advertise runtime options that they cannot apply; Node server options remain on `createNodeEntry`, where they affect server startup.
- b6449cc: HTTP runtime packages now require a patched Hono range so production dependency audits do not include known high-severity Hono advisories.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [d281518]
- Updated dependencies [d707a0c]
  - @croco/framework-preset@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- 99f2a6b: raise runtime dependency floors to patched security releases
- Updated dependencies [99f2a6b]
  - @croco/framework-preset@0.0.3
