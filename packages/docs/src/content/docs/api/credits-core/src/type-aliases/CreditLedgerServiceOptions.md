---
editUrl: false
next: false
prev: false
title: "CreditLedgerServiceOptions"
---

> **CreditLedgerServiceOptions** = `object`

## Properties

### clock?

> `readonly` `optional` **clock?**: () => `Date`

#### Returns

`Date`

***

### eventPublisher?

> `readonly` `optional` **eventPublisher?**: [`CreditLedgerEventPublisher`](/api/credits-core/src/interfaces/creditledgereventpublisher/)

***

### idGenerator?

> `readonly` `optional` **idGenerator?**: () => `string`

#### Returns

`string`

***

### onPendingEventEvicted?

> `readonly` `optional` **onPendingEventEvicted?**: (`idempotencyKey`) => `void`

#### Parameters

##### idempotencyKey

`string`

#### Returns

`void`

***

### pendingEventLimit?

> `readonly` `optional` **pendingEventLimit?**: `number`

***

### store

> `readonly` **store**: [`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/)
