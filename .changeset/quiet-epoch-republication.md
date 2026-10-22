---
"@croco/warehouse-core": patch
"@croco/warehouse-postgres": patch
"@croco/etl-core": patch
"@croco/admin-react": patch
---

Expose management head identity and availability separately from pinned snapshot reads so ETL can republish after privacy or permission epoch changes while preserving old-snapshot rejection and publication CAS fencing. CatalogStore implementations must return headId and headStatus in dataset descriptions. Dataset Explorer preserves the audited recovery identity for stale or unavailable publications without displaying their samples.
