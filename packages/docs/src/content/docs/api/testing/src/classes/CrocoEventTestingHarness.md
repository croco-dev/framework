---
editUrl: false
next: false
prev: false
title: "CrocoEventTestingHarness"
---

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new CrocoEventTestingHarness**\<`TEvent`\>(`eventBus`, `config`, `transactionContext`): `CrocoEventTestingHarness`\<`TEvent`\>

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)\<`TEvent`\>

##### config

[`EventBusConfig`](/api/events-core/src/classes/eventbusconfig/)

##### transactionContext

[`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/) \| `null`

#### Returns

`CrocoEventTestingHarness`\<`TEvent`\>

## Properties

### config

> `readonly` **config**: [`EventBusConfig`](/api/events-core/src/classes/eventbusconfig/)

***

### eventBus

> `readonly` **eventBus**: [`EventBus`](/api/events-core/src/interfaces/eventbus/)\<`TEvent`\>

***

### transactionContext

> `readonly` **transactionContext**: [`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/) \| `null`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### dispatch()

> **dispatch**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

***

### flushAfterCommitHooks()

> **flushAfterCommitHooks**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

***

### publishAfterCommit()

> **publishAfterCommit**(`event`): `void`

#### Parameters

##### event

`TEvent`

#### Returns

`void`
