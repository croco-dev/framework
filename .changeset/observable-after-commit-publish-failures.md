---
"@croco/events-core": minor
"@croco/events-inmemory": patch
"@croco/problems-core": patch
---

Expose committed event publication failures through `publishAfterCommit` error callbacks and a stable Problem code.
Count every `InMemoryEventBus` publish outcome once, including closed-intake and payload-preparation failures, while
avoiding duplicate after-commit accounting for buses that already manage publish statistics.
