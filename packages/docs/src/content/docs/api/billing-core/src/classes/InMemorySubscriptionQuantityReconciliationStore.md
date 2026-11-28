---
editUrl: false
next: false
prev: false
title: "InMemorySubscriptionQuantityReconciliationStore"
---

In-memory reconciliation intent store for tests and local composition.

## Implements

- [`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/)

## Constructors

### Constructor

> **new InMemorySubscriptionQuantityReconciliationStore**(`clock?`): `InMemorySubscriptionQuantityReconciliationStore`

#### Parameters

##### clock?

() => `Date`

#### Returns

`InMemorySubscriptionQuantityReconciliationStore`

## Methods

### createOrSupersede()

> **createOrSupersede**(`intent`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Parameters

##### intent

[`CreateSubscriptionQuantityIntent`](/api/billing-core/src/type-aliases/createsubscriptionquantityintent/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`createOrSupersede`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#createorsupersede)

---

### findCurrent()

> **findCurrent**(`tenantId`, `externalSubscriptionId`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`findCurrent`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#findcurrent)

---

### getDiagnostics()

> **getDiagnostics**(`options`): `Promise`\<[`SubscriptionQuantityDiagnostics`](/api/billing-core/src/type-aliases/subscriptionquantitydiagnostics/)\>

Count current intents by state: `pending`, `drifted`, `retryable_failed` (`retrying`), and
`unsupported`. Use the earliest creation time among the first three states for
`oldestPendingAt`, or null when none exist.

Count `terminal_failed` intents with non-retryable failure evidence as `terminalFailed`.
Count terminal intents with retryable evidence and at least `maxAttempts` attempts as
`retryExhausted`. The mismatch counts use their existing failure codes and can overlap state counts.

Stores that have not implemented the new counters may omit `retrying` and `terminalFailed`.
An omitted counter means its value is unavailable.

#### Parameters

##### options

###### maxAttempts

`number`

###### sampleLimit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantityDiagnostics`](/api/billing-core/src/type-aliases/subscriptionquantitydiagnostics/)\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`getDiagnostics`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#getdiagnostics)

---

### listRecent()

> **listRecent**(`limit`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`listRecent`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#listrecent)

---

### listRepairable()

> **listRepairable**(`limit`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Parameters

##### limit

`number`

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)[]\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`listRepairable`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#listrepairable)

---

### saveIfCurrent()

> **saveIfCurrent**(`snapshot`): `Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Parameters

##### snapshot

[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/)

#### Returns

`Promise`\<[`SubscriptionQuantitySnapshot`](/api/billing-core/src/type-aliases/subscriptionquantitysnapshot/) \| `null`\>

#### Implementation of

[`SubscriptionQuantityReconciliationStore`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/).[`saveIfCurrent`](/api/billing-core/src/interfaces/subscriptionquantityreconciliationstore/#saveifcurrent)
