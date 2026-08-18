---
editUrl: false
next: false
prev: false
title: "InMemoryBillableUsageJournal"
---

Reference journal for tests and single-process development.
Production adapters must implement BillableUsageJournal with persistent storage.

## Implements

- [`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/)

## Constructors

### Constructor

> **new InMemoryBillableUsageJournal**(): `InMemoryBillableUsageJournal`

#### Returns

`InMemoryBillableUsageJournal`

## Properties

### durability

> `readonly` **durability**: `"volatile"`

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`durability`](/api/metering-core/src/interfaces/billableusagejournal/#durability)

## Methods

### append()

> **append**(`event`, `now?`): `Promise`\<[`BillableUsageAppendResult`](/api/metering-core/src/type-aliases/billableusageappendresult/)\>

#### Parameters

##### event

[`BillableUsageEvent`](/api/metering-core/src/type-aliases/billableusageevent/)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageAppendResult`](/api/metering-core/src/type-aliases/billableusageappendresult/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`append`](/api/metering-core/src/interfaces/billableusagejournal/#append)

---

### claimNext()

> **claimNext**(`options`): `Promise`\<[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/) \| `null`\>

#### Parameters

##### options

[`BillableUsageClaimOptions`](/api/metering-core/src/type-aliases/billableusageclaimoptions/)

#### Returns

`Promise`\<[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/) \| `null`\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`claimNext`](/api/metering-core/src/interfaces/billableusagejournal/#claimnext)

---

### get()

> **get**(`eventId`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/) \| `null`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/) \| `null`\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`get`](/api/metering-core/src/interfaces/billableusagejournal/#get)

---

### getDiagnostics()

> **getDiagnostics**(`now?`): `Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/)\>

#### Parameters

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`getDiagnostics`](/api/metering-core/src/interfaces/billableusagejournal/#getdiagnostics)

---

### markAccepted()

> **markAccepted**(`claim`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markAccepted`](/api/metering-core/src/interfaces/billableusagejournal/#markaccepted)

---

### markDeliverable()

> **markDeliverable**(`eventId`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### eventId

`string`

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markDeliverable`](/api/metering-core/src/interfaces/billableusagejournal/#markdeliverable)

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

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markRetryableFailed`](/api/metering-core/src/interfaces/billableusagejournal/#markretryablefailed)

---

### markTerminalFailed()

> **markTerminalFailed**(`claim`, `failure`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markTerminalFailed`](/api/metering-core/src/interfaces/billableusagejournal/#markterminalfailed)

---

### markUndeliverable()

> **markUndeliverable**(`eventId`, `failure`, `now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### eventId

`string`

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markUndeliverable`](/api/metering-core/src/interfaces/billableusagejournal/#markundeliverable)
