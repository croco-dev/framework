---
editUrl: false
next: false
prev: false
title: "DrizzleCreditLedgerStore"
---

PostgreSQL-backed credit ledger store.

Writes lock the account row for the whole transaction. This makes allocation, balance projection,
reservation settlement, and immutable ledger append one atomic critical section at READ COMMITTED.

## Extends

- [`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/)

## Constructors

### Constructor

> **new DrizzleCreditLedgerStore**(`db`, `txManager`): `DrizzleCreditLedgerStore`

#### Parameters

##### db

[`DrizzleCreditClient`](/api/credits-drizzle/src/type-aliases/drizzlecreditclient/)

##### txManager

[`DrizzleCreditTxManager`](/api/credits-drizzle/src/type-aliases/drizzlecredittxmanager/)

#### Returns

`DrizzleCreditLedgerStore`

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`constructor`](/api/credits-core/src/classes/creditledgerstore/#constructor)

## Properties

### eventIntentDurability

> `readonly` **eventIntentDurability**: `"persistent"`

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`eventIntentDurability`](/api/credits-core/src/classes/creditledgerstore/#eventintentdurability)

## Methods

### execute()

> **execute**(`command`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### command

[`CreditLedgerCommand`](/api/credits-core/src/type-aliases/creditledgercommand/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`execute`](/api/credits-core/src/classes/creditledgerstore/#execute)

---

### getAccount()

> **getAccount**(`accountId`): `Promise`\<[`CreditAccount`](/api/credits-core/src/type-aliases/creditaccount/) \| `null`\>

#### Parameters

##### accountId

[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

#### Returns

`Promise`\<[`CreditAccount`](/api/credits-core/src/type-aliases/creditaccount/) \| `null`\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`getAccount`](/api/credits-core/src/classes/creditledgerstore/#getaccount)

---

### getBalance()

> **getBalance**(`accountId`, `atPosition?`): `Promise`\<[`CreditBalance`](/api/credits-core/src/type-aliases/creditbalance/)\>

#### Parameters

##### accountId

[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

##### atPosition?

`number`

#### Returns

`Promise`\<[`CreditBalance`](/api/credits-core/src/type-aliases/creditbalance/)\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`getBalance`](/api/credits-core/src/classes/creditledgerstore/#getbalance)

---

### getHistory()

> **getHistory**(`accountId`, `options?`): `Promise`\<[`CreditHistoryPage`](/api/credits-core/src/type-aliases/credithistorypage/)\>

#### Parameters

##### accountId

[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

##### options?

###### afterPosition?

`number`

###### atPosition?

`number`

###### limit?

`number`

#### Returns

`Promise`\<[`CreditHistoryPage`](/api/credits-core/src/type-aliases/credithistorypage/)\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`getHistory`](/api/credits-core/src/classes/creditledgerstore/#gethistory)

---

### getPendingEventIntent()

> **getPendingEventIntent**(`tenantId`, `idempotencyKey`): `Promise`\<[`CreditLedgerEventIntent`](/api/credits-core/src/type-aliases/creditledgereventintent/) \| `null`\>

#### Parameters

##### tenantId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`CreditLedgerEventIntent`](/api/credits-core/src/type-aliases/creditledgereventintent/) \| `null`\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`getPendingEventIntent`](/api/credits-core/src/classes/creditledgerstore/#getpendingeventintent)

---

### getReservation()

> **getReservation**(`accountId`, `reservationId`): `Promise`\<[`CreditReservation`](/api/credits-core/src/type-aliases/creditreservation/) \| `null`\>

#### Parameters

##### accountId

[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

##### reservationId

[`CreditReservationId`](/api/credits-core/src/type-aliases/creditreservationid/)

#### Returns

`Promise`\<[`CreditReservation`](/api/credits-core/src/type-aliases/creditreservation/) \| `null`\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`getReservation`](/api/credits-core/src/classes/creditledgerstore/#getreservation)

---

### listPendingEventIntents()

> **listPendingEventIntents**(`limit?`): `Promise`\<readonly [`CreditLedgerEventIntent`](/api/credits-core/src/type-aliases/creditledgereventintent/)[]\>

#### Parameters

##### limit?

`number` = `100`

#### Returns

`Promise`\<readonly [`CreditLedgerEventIntent`](/api/credits-core/src/type-aliases/creditledgereventintent/)[]\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`listPendingEventIntents`](/api/credits-core/src/classes/creditledgerstore/#listpendingeventintents)

---

### markEventIntentPublished()

> **markEventIntentPublished**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CreditLedgerStore`](/api/credits-core/src/classes/creditledgerstore/).[`markEventIntentPublished`](/api/credits-core/src/classes/creditledgerstore/#markeventintentpublished)
