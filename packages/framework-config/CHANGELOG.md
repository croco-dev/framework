# @croco/framework-config

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- aacdad6: Decorator packages now declare `reflect-metadata` as a runtime dependency whenever their published source imports it, so strict consumers can import those decorators without relying on undeclared transitive installs.
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [a61dcd4]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
  - @croco/framework-context@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix(framework-config): tighten ConfigSchema decorator type contract

  Replaced `new (...args: any[]) => any` constructor type with `abstract new (...args: unknown[]) => unknown` and narrowed `getConfigSchema` metadata cast through `unknown` intermediary, preserving backward compatibility for explicit generic `bootstrapConfig<AppConfig>(AppConfig)` calls.

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/problems-core@0.0.3
