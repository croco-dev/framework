---
editUrl: false
next: false
prev: false
title: "InboxStartResult"
---

> **InboxStartResult** = \{ `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"started"`; \} \| \{ `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"duplicate"`; \} \| \{ `lockedUntil`: `Date` \| `undefined`; `record`: [`TransactionalInboxRecord`](/api/events-tx/src/type-aliases/transactionalinboxrecord/); `status`: `"in_progress"`; \}
