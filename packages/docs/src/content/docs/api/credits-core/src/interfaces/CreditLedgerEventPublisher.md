---
editUrl: false
next: false
prev: false
title: "CreditLedgerEventPublisher"
---

## Methods

### publishIdempotently()

> **publishIdempotently**(`event`): `Promise`\<`void`\>

Must deduplicate retries and concurrent deliveries by `event.eventId`.

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

***

### publishIdempotentlyAfterCommit()

> **publishIdempotentlyAfterCommit**(`event`, `onPublished`): `void`

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

##### onPublished

() => `Promise`\<`void`\>

#### Returns

`void`
