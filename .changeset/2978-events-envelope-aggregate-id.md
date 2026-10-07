---
"@croco/events-core": patch
---

DefaultEventSerializer now restores the envelope aggregateId when the event declares it without @EventField, so outbox-relayed events keep their aggregateId.
