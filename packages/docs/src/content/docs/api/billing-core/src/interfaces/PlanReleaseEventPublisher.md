---
editUrl: false
next: false
prev: false
title: "PlanReleaseEventPublisher"
---

## Methods

### publishIdempotently()

> **publishIdempotently**(`event`): `Promise`\<`void`\>

Must deduplicate retries and concurrent deliveries by `event.eventId`.

#### Parameters

##### event

[`PlanReleaseLifecycleEvent`](/api/billing-core/src/type-aliases/planreleaselifecycleevent/)

#### Returns

`Promise`\<`void`\>
