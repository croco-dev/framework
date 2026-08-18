---
editUrl: false
next: false
prev: false
title: "RedisBillableUsageJournal"
---

Redis-backed durable billable usage journal with atomic Lua transitions and fenced leases.

## Implements

- [`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/)

## Constructors

### Constructor

> **new RedisBillableUsageJournal**(`redis`): `RedisBillableUsageJournal`

#### Parameters

##### redis

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

#### Returns

`RedisBillableUsageJournal`

## Properties

### durability

> `readonly` **durability**: `"persistent"`

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

> **getDiagnostics**(`_now?`): `Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/)\>

#### Parameters

##### \_now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`getDiagnostics`](/api/metering-core/src/interfaces/billableusagejournal/#getdiagnostics)

---

### markAccepted()

> **markAccepted**(`claim`, `_now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### \_now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markAccepted`](/api/metering-core/src/interfaces/billableusagejournal/#markaccepted)

---

### markDeliverable()

> **markDeliverable**(`eventId`, `_now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### eventId

`string`

##### \_now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markDeliverable`](/api/metering-core/src/interfaces/billableusagejournal/#markdeliverable)

---

### markRetryableFailed()

> **markRetryableFailed**(`claim`, `failure`, `retryAt`, `_now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### retryAt

`Date`

##### \_now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markRetryableFailed`](/api/metering-core/src/interfaces/billableusagejournal/#markretryablefailed)

---

### markTerminalFailed()

> **markTerminalFailed**(`claim`, `failure`, `_now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### claim

[`BillableUsageClaim`](/api/metering-core/src/type-aliases/billableusageclaim/)

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### \_now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markTerminalFailed`](/api/metering-core/src/interfaces/billableusagejournal/#markterminalfailed)

---

### markUndeliverable()

> **markUndeliverable**(`eventId`, `failure`, `_now?`): `Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Parameters

##### eventId

`string`

##### failure

[`BillableUsageFailure`](/api/metering-core/src/type-aliases/billableusagefailure/)

##### \_now?

`Date` = `...`

#### Returns

`Promise`\<[`BillableUsageJournalEntry`](/api/metering-core/src/type-aliases/billableusagejournalentry/)\>

#### Implementation of

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/).[`markUndeliverable`](/api/metering-core/src/interfaces/billableusagejournal/#markundeliverable)
