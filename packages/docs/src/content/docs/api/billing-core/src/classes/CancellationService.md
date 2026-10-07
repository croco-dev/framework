---
editUrl: false
next: false
prev: false
title: "CancellationService"
---

## Constructors

### Constructor

> **new CancellationService**(`dependencies`): `CancellationService`

#### Parameters

##### dependencies

[`CancellationServiceDependencies`](/api/billing-core/src/type-aliases/cancellationservicedependencies/)

#### Returns

`CancellationService`

## Methods

### createSession()

> **createSession**(`identity`, `id`): `Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

##### id

`string`

#### Returns

`Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

---

### decide()

> **decide**(`identity`, `id`, `decision`): `Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

##### id

`string`

##### decision

[`CancellationDecision`](/api/billing-core/src/type-aliases/cancellationdecision/)

#### Returns

`Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

---

### listSessions()

> **listSessions**(`scope`, `actor`): `Promise`\<readonly [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)[]\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

##### actor

`string`

#### Returns

`Promise`\<readonly [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)[]\>

---

### markDisplayed()

> **markDisplayed**(`identity`, `id`): `Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

##### id

`string`

#### Returns

`Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

---

### reconcile()

> **reconcile**(`identity`, `id`): `Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

#### Parameters

##### identity

[`CancellationIdentity`](/api/billing-core/src/type-aliases/cancellationidentity/)

##### id

`string`

#### Returns

`Promise`\<[`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/)\>

---

### updatePolicy()

> **updatePolicy**(`scope`, `entries`, `audit`): `Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)\>

#### Parameters

##### scope

[`CancellationScope`](/api/billing-core/src/type-aliases/cancellationscope/)

##### entries

readonly [`ChoicePolicyEntry`](/api/billing-core/src/type-aliases/choicepolicyentry/)[]

##### audit

[`ChoicePolicyAudit`](/api/billing-core/src/type-aliases/choicepolicyaudit/)

#### Returns

`Promise`\<[`ChoicePolicy`](/api/billing-core/src/type-aliases/choicepolicy/)\>
