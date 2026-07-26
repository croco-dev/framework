---
editUrl: false
next: false
prev: false
title: "CreditLedgerEventPublisher"
---

## Methods

### publishAfterCommit()

> **publishAfterCommit**(`event`, `onPublished?`): `void`

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

##### onPublished?

() => `void`

#### Returns

`void`

***

### publishNow()

> **publishNow**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>
