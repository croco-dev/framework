---
editUrl: false
next: false
prev: false
title: "ImpersonationLifecycleEventPublisher"
---

## Constructors

### Constructor

> **new ImpersonationLifecycleEventPublisher**(): `ImpersonationLifecycleEventPublisher`

#### Returns

`ImpersonationLifecycleEventPublisher`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`ImpersonationLifecycleEventPublisher`\>

## Methods

### publishIdempotently()

> `abstract` **publishIdempotently**(`event`): `Promise`\<`void`\>

Must deduplicate retries and concurrent deliveries by `event.eventId`.

#### Parameters

##### event

[`ImpersonationStartedEvent`](/api/impersonation-core/src/classes/impersonationstartedevent/) \| [`ImpersonationEndedEvent`](/api/impersonation-core/src/classes/impersonationendedevent/)

#### Returns

`Promise`\<`void`\>
