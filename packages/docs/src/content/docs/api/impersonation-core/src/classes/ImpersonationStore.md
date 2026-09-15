---
editUrl: false
next: false
prev: false
title: "ImpersonationStore"
---

## Extended by

- [`InMemoryImpersonationStore`](/api/impersonation-core/src/classes/inmemoryimpersonationstore/)

## Constructors

### Constructor

> **new ImpersonationStore**(): `ImpersonationStore`

#### Returns

`ImpersonationStore`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`ImpersonationStore`\>

## Methods

### commitEnd()

> `abstract` **commitEnd**(`intent`, `impersonatorId`): `Promise`\<`"committed"` \| `"actor-mismatch"` \| `"already-published"` \| `"committed-start-pending"` \| `"session-not-found"`\>

Atomically revokes the active session and persists its pending ended-event intent.
Repeated commits for the same session and actor must retain the first canonical intent and
return its current publication status. Returns `committed-start-pending` when the started-event
intent still requires publication and `already-published` after the ended event is acknowledged.

#### Parameters

##### intent

[`ImpersonationEndedEventIntent`](/api/impersonation-core/src/type-aliases/impersonationendedeventintent/)

##### impersonatorId

`string`

#### Returns

`Promise`\<`"committed"` \| `"actor-mismatch"` \| `"already-published"` \| `"committed-start-pending"` \| `"session-not-found"`\>

---

### commitStart()

> `abstract` **commitStart**(`intent`): `Promise`\<`"committed"` \| `"impersonator-active"`\>

Atomically claims the session's impersonator, persists the active session, and records its
pending started-event intent. Persistent stores must enforce unique session IDs and the actor
claim with uniqueness constraints or equivalent compare-and-set operations that replace an
expired actor claim in the same operation.

#### Parameters

##### intent

[`ImpersonationStartedEventIntent`](/api/impersonation-core/src/type-aliases/impersonationstartedeventintent/)

#### Returns

`Promise`\<`"committed"` \| `"impersonator-active"`\>

---

### find()

> `abstract` **find**(`sessionId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

---

### findByImpersonator()

> `abstract` **findByImpersonator**(`impersonatorId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### impersonatorId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

---

### findCommittedEndIntent()

> `abstract` **findCommittedEndIntent**(`sessionId`): `Promise`\<[`ImpersonationEndedEventIntent`](/api/impersonation-core/src/type-aliases/impersonationendedeventintent/) \| `null`\>

Returns the canonical committed end intent, including after publication acknowledgement.

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`ImpersonationEndedEventIntent`](/api/impersonation-core/src/type-aliases/impersonationendedeventintent/) \| `null`\>

---

### listPendingLifecycleEventIntents()

> `abstract` **listPendingLifecycleEventIntents**(`limit?`): `Promise`\<readonly [`ImpersonationLifecycleEventIntent`](/api/impersonation-core/src/type-aliases/impersonationlifecycleeventintent/)[]\>

Lists oldest intents first and preserves started-before-ended ordering for each session.

#### Parameters

##### limit?

`number`

#### Returns

`Promise`\<readonly [`ImpersonationLifecycleEventIntent`](/api/impersonation-core/src/type-aliases/impersonationlifecycleeventintent/)[]\>

---

### markLifecycleEventPublished()

> `abstract` **markLifecycleEventPublished**(`eventId`): `Promise`\<`void`\>

Idempotently acknowledges a published event intent.

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>
