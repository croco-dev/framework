---
"@croco/search-core": patch
---

Reject failed automatic index and delete deliveries after publishing the failure event so event infrastructure can retry them and recover the search index.
