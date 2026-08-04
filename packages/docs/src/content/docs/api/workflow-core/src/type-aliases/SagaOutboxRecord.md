---
editUrl: false
next: false
prev: false
title: "SagaOutboxRecord"
---

> **SagaOutboxRecord** = [`SagaOutboxMessage`](/api/workflow-core/src/type-aliases/sagaoutboxmessage/) & `object`

## Type Declaration

### deliveryId

> `readonly` **deliveryId**: `string`

Stable across retries and replays. Publishers must use this value to deduplicate delivery.

### enqueuedAt

> `readonly` **enqueuedAt**: `string`

### phase

> `readonly` **phase**: `"step"` \| `"compensation"`

### publishedAt?

> `readonly` `optional` **publishedAt?**: `string`

### status

> `readonly` **status**: [`SagaOutboxStatus`](/api/workflow-core/src/type-aliases/sagaoutboxstatus/)

### stepId

> `readonly` **stepId**: `string`
