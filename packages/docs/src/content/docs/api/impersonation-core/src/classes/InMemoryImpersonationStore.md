---
editUrl: false
next: false
prev: false
title: "InMemoryImpersonationStore"
---

## Extends

- [`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/)

## Constructors

### Constructor

> **new InMemoryImpersonationStore**(): `InMemoryImpersonationStore`

#### Returns

`InMemoryImpersonationStore`

#### Inherited from

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`constructor`](/api/impersonation-core/src/classes/impersonationstore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/)\>

#### Inherited from

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`token`](/api/impersonation-core/src/classes/impersonationstore/#token)

## Methods

### commitEnd()

> **commitEnd**(`intent`, `impersonatorId`): `Promise`\<`"committed"` \| `"actor-mismatch"` \| `"committed-start-pending"` \| `"session-not-found"`\>

Atomically revokes the active session and persists its pending ended-event intent.
Returns `committed-start-pending` when the started-event intent still requires publication.

#### Parameters

##### intent

[`ImpersonationEndedEventIntent`](/api/impersonation-core/src/type-aliases/impersonationendedeventintent/)

##### impersonatorId

`string`

#### Returns

`Promise`\<`"committed"` \| `"actor-mismatch"` \| `"committed-start-pending"` \| `"session-not-found"`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`commitEnd`](/api/impersonation-core/src/classes/impersonationstore/#commitend)

---

### commitStart()

> **commitStart**(`intent`): `Promise`\<`"committed"` \| `"impersonator-active"`\>

Atomically claims the session's impersonator, persists the active session, and records its
pending started-event intent. Persistent stores must enforce unique session IDs and the actor
claim with uniqueness constraints or equivalent compare-and-set operations that replace an
expired actor claim in the same operation.

#### Parameters

##### intent

[`ImpersonationStartedEventIntent`](/api/impersonation-core/src/type-aliases/impersonationstartedeventintent/)

#### Returns

`Promise`\<`"committed"` \| `"impersonator-active"`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`commitStart`](/api/impersonation-core/src/classes/impersonationstore/#commitstart)

---

### find()

> **find**(`sessionId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`find`](/api/impersonation-core/src/classes/impersonationstore/#find)

---

### findByImpersonator()

> **findByImpersonator**(`impersonatorId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### impersonatorId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`findByImpersonator`](/api/impersonation-core/src/classes/impersonationstore/#findbyimpersonator)

---

### listPendingLifecycleEventIntents()

> **listPendingLifecycleEventIntents**(`limit?`): `Promise`\<readonly [`ImpersonationLifecycleEventIntent`](/api/impersonation-core/src/type-aliases/impersonationlifecycleeventintent/)[]\>

Lists oldest intents first and preserves started-before-ended ordering for each session.

#### Parameters

##### limit?

`number` = `100`

#### Returns

`Promise`\<readonly [`ImpersonationLifecycleEventIntent`](/api/impersonation-core/src/type-aliases/impersonationlifecycleeventintent/)[]\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`listPendingLifecycleEventIntents`](/api/impersonation-core/src/classes/impersonationstore/#listpendinglifecycleeventintents)

---

### markLifecycleEventPublished()

> **markLifecycleEventPublished**(`eventId`): `Promise`\<`void`\>

Idempotently acknowledges a published event intent.

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`markLifecycleEventPublished`](/api/impersonation-core/src/classes/impersonationstore/#marklifecycleeventpublished)
