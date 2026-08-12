---
editUrl: false
next: false
prev: false
title: "BillableUsageJournal"
---

Durable provider-delivery journal contract.

Implementations must make every transition atomic. Implementations whose `durability` is `"persistent"` must
persist entries independently of the request process.
A claim is valid only before its server-time lease expires, for its owner, and with its monotonically increasing
fencing token.

## Properties

### durability

> `readonly` **durability**: `"persistent"` \| `"volatile"`

## Methods

### append()

> **append**(`event`, `now?`): `Promise`\<[`BillableUsageAppendResult`](/api/metering-core/src/type-aliases/billableusageappendresult/)\>

#### Parameters

##### event

[`BillableUsageEvent`](/api/metering-core/src/type-aliases/billableusageevent/)

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageAppendResult`](/api/metering-core/src/type-aliases/billableusageappendresult/)\>

---

### claimNext()

> **claimNext**(`options`): `Promise`\<[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/) \| `null`\>

#### Parameters

##### options

[`BillableUsageClaimOptions`](/api/metering-core/src/type-aliases/billableusageclaimoptions/)

#### Returns

`Promise`\<[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/) \| `null`\>

---

### get()

> **get**(`eventId`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/) \| `null`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/) \| `null`\>

---

### getDiagnostics()

> **getDiagnostics**(`now?`): `Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/)\>

#### Parameters

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/)\>

---

### markAccepted()

> **markAccepted**(`claim`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

---

### markDeliverable()

> **markDeliverable**(`eventId`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### eventId

`string`

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

---

### markRetryableFailed()

> **markRetryableFailed**(`claim`, `failure`, `retryAt`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### retryAt

`Date`

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

---

### markTerminalFailed()

> **markTerminalFailed**(`claim`, `failure`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

---

### markUndeliverable()

> **markUndeliverable**(`eventId`, `failure`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### eventId

`string`

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### now?

`Date`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>
