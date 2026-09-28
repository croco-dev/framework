---
"@croco/etl-core": minor
"@croco/etl-events-tx": minor
"@croco/events-tx": patch
---

Confirmed outbox events can be validated as ETL sources and accepted as durable warehouse facts without changing the domain transaction's result. Analytics inbox acknowledgement follows a durable fact receipt or quarantine record; exact-ID replay reports unavailable retained history, and in-memory outbox claims preserve aggregate order.
