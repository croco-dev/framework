---
editUrl: false
next: false
prev: false
title: "SagaOutboxPublisher"
---

> **SagaOutboxPublisher** = `object`

## Properties

### publish

> `readonly` **publish**: (`message`, `context`) => `void` \| `Promise`\<`void`\>

Implementations must make repeated calls with the same message.deliveryId idempotent.

#### Parameters

##### message

[`SagaOutboxRecord`](/api/workflow-core/src/type-aliases/sagaoutboxrecord/)

##### context

[`SagaOutboxPublishContext`](/api/workflow-core/src/type-aliases/sagaoutboxpublishcontext/)

#### Returns

`void` \| `Promise`\<`void`\>
