---
"@croco/framework-config": patch
---

fix(framework-config): tighten ConfigSchema decorator type contract

Replaced `new (...args: any[]) => any` constructor type with `abstract new (...args: unknown[]) => unknown` and narrowed `getConfigSchema` metadata cast through `unknown` intermediary, preserving backward compatibility for explicit generic `bootstrapConfig<AppConfig>(AppConfig)` calls.
