# @croco/framework-config

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
