---
"@croco/experience-core": patch
"@croco/experience-drizzle": patch
"@croco/admin-core": patch
---

Evaluate published experience configurations independently of archived history, paginate operator reads, and enforce publication capacity atomically. Custom ExperienceStore implementations must provide complete listPublishedConfigs and scoped getConfig methods.
