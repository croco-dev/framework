---
"@croco/onboarding-core": patch
"@croco/problems-core": patch
---

Keep in-memory onboarding progress immutable from caller-owned save inputs, loaded status snapshots, and successful completion results, and reject metadata that cannot become an independent snapshot with a stable Problem.
