---
"@croco/analytics-core": patch
---

Fact History stops returning a superseded fact once its correction is known, even when the corrected effective interval excludes the queried time. Reads at earlier knowledge cutoffs still return the original fact where it was effective.
