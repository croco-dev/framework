---
"@croco/experience-core": minor
"@croco/experience-drizzle": minor
"@croco/admin-core": patch
"@croco/problems-core": patch
---

Evaluate published experience configurations independently of archived history, paginate operator reads, and enforce publication capacity atomically. New publications require read-committed transactions so retained snapshots cannot bypass capacity. Custom ExperienceStore implementations must provide complete listPublishedConfigs and scoped getConfig methods.
