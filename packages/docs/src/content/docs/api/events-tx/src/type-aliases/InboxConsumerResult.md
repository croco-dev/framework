---
editUrl: false
next: false
prev: false
title: "InboxConsumerResult"
---

> **InboxConsumerResult** = \{ `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"processed"`; \} \| \{ `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"duplicate"`; \} \| \{ `error`: [`TransactionalEventError`](/api/events-tx/src/type-aliases/transactionaleventerror/); `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"failed"`; \}
