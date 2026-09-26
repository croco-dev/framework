---
editUrl: false
next: false
prev: false
title: "InboxConsumerResult"
---

> **InboxConsumerResult** = \{ `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"processed"`; \} \| \{ `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"duplicate"`; \} \| \{ `lockedUntil`: `Date` \| `undefined`; `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"in_progress"`; \} \| \{ `error`: [`TransactionalEventError`](/api/events-tx/src/type-aliases/transactionaleventerror/); `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"failed"`; \}
