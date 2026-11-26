---
"@croco/problems-core": minor
---

Stop shipping declaration source locations in `CROCO_PROBLEM_CODE_REGISTRY`.

Entries of `CROCO_PROBLEM_CODE_REGISTRY.problems` no longer have `sources`, and entries of
`dynamicCodeFactories` no longer have `source`. The `CrocoProblemRegistry` type changes with them.
Codes, categories, statuses, recovery metadata and lifecycle are unchanged, and
`docs/problem-code-registry.json` keeps every source location.

Before this change, moving a Problem declaration by one line in any package rewrote the module
compiled into `@croco/problems-core`, which invalidated the build and test cache of every package
that depends on it.

Migration: read source locations from `docs/problem-code-registry.json` instead of the packaged
constant.
