---
editUrl: false
next: false
prev: false
title: "EventTestingHarnessOptions"
---

> **EventTestingHarnessOptions**\<`TEvent`\> = `object`

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### eventBus?

> `readonly` `optional` **eventBus?**: [`EventBus`](/api/events-core/src/interfaces/eventbus/)\<`TEvent`\>

***

### handlers?

> `readonly` `optional` **handlers?**: readonly [`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`TEvent`\>[]

***

### inMemoryEventBus?

> `readonly` `optional` **inMemoryEventBus?**: [`InMemoryEventBusOptions`](/api/events-inmemory/src/type-aliases/inmemoryeventbusoptions/)

***

### logger?

> `readonly` `optional` **logger?**: [`TestLogger`](/api/testing/src/type-aliases/testlogger/)

***

### providers?

> `readonly` `optional` **providers?**: readonly [`TestingProvider`](/api/testing/src/type-aliases/testingprovider/)[]

***

### resetContainer?

> `readonly` `optional` **resetContainer?**: `boolean`

***

### subscriptions?

> `readonly` `optional` **subscriptions?**: readonly [`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>[]

***

### transactionContext?

> `readonly` `optional` **transactionContext?**: [`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/) \| [`TestingTransactionContextOptions`](/api/testing/src/type-aliases/testingtransactioncontextoptions/) \| `false`
