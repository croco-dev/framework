---
"@croco/engagement-core": patch
---

Preserve explicit cause retryability in directory, suppression, persistence, and dispatch failures so campaign members do not retry permanent failures. Unclassified ordinary dispatch errors follow the campaign retry default; rendering and recorded dispatch replay retain their terminal policies.
