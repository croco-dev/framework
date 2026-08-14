---
editUrl: false
next: false
prev: false
title: "PolarWebhookEventPublisher"
---

> **PolarWebhookEventPublisher** = `object`

Event publication contract required by Polar webhook handling.

Existing `EventPublisher` instances must be wrapped by an adapter that durably deduplicates a
stable event identity before implementing `publishIdempotently`; forwarding that method directly
to `publishNow` does not satisfy this contract.

## Methods

### publishIdempotently()

> **publishIdempotently**(`event`): `Promise`\<`void`\>

Publishes one logical event exactly once across retries and concurrent workers.

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

---

### publishNow()

> **publishNow**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>
