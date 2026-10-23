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

Stable across retries and replays of the same message content. Publishers must deduplicate by this opaque value.

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
