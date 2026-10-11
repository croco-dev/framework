---
"@croco/pagination-core": patch
---

`createCursorPage` now rejects non-integer or below-minimum limits with `InvalidPaginationLimitProblem` instead of returning self-contradicting pages.
