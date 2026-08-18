---
editUrl: false
next: false
prev: false
title: "PubSub"
---

## Methods

### publish()

> **publish**(`routingKey`, ...`args`): `void`

Publish a value for a given topic.

#### Parameters

##### routingKey

`string`

##### args

...`unknown`[]

#### Returns

`void`

---

### subscribe()

> **subscribe**(`routingKey`, `dynamicId?`): `AsyncIterable`\<`unknown`\>

Subscribe to a topic.

#### Parameters

##### routingKey

`string`

##### dynamicId?

`unknown`

#### Returns

`AsyncIterable`\<`unknown`\>
