---
editUrl: false
next: false
prev: false
title: "MembershipEventPublisher"
---

## Methods

### publishIdempotently()

> **publishIdempotently**(`event`): `Promise`\<`void`\>

Implementations must deduplicate retries and concurrent deliveries by `event.eventId`.

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>
