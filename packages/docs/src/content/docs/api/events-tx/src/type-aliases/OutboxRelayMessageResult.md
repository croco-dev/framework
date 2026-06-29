---
editUrl: false
next: false
prev: false
title: "OutboxRelayMessageResult"
---

> **OutboxRelayMessageResult** = \{ `message`: [`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/); `status`: `"published"`; \} \| \{ `error`: [`TransactionalEventError`](/api/events-tx/src/type-aliases/transactionaleventerror/); `message`: [`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/); `status`: `"scheduled_retry"`; \} \| \{ `error`: [`TransactionalEventError`](/api/events-tx/src/type-aliases/transactionaleventerror/); `message`: [`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/); `problem`: [`OutboxPublishExhaustedProblem`](/api/events-tx/src/classes/outboxpublishexhaustedproblem/); `status`: `"poisoned"` \| `"dead_lettered"`; \} \| \{ `diagnostic`: [`TransactionalEventDiagnostic`](/api/events-tx/src/type-aliases/transactionaleventdiagnostic/); `message`: [`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/); `status`: `"stale_claim"`; \}
