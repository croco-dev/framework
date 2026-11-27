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

The packaged constant no longer satisfies `ProblemCodeRegistry`, so passing it to
`assertProblemCodeRegistryValid()` or `getProblemCodeRegistryValidationErrors()` fails to typecheck.

Migration: read source locations from `docs/problem-code-registry.json` in the croco-dev/framework
repository at the release tag. The file is not part of the npm package.
