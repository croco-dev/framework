---
editUrl: false
next: false
prev: false
title: "CreditLedgerService"
---

## Constructors

### Constructor

> **new CreditLedgerService**(`options`): `CreditLedgerService`

#### Parameters

##### options

[`CreditLedgerServiceOptions`](/api/credits-core/src/type-aliases/creditledgerserviceoptions/)

#### Returns

`CreditLedgerService`

## Methods

### adjustCredits()

> **adjustCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`AdjustCreditsInput`](/api/credits-core/src/type-aliases/adjustcreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### commitCredits()

> **commitCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`CommitCreditsInput`](/api/credits-core/src/type-aliases/commitcreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### consumeCredits()

> **consumeCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`ConsumeCreditsInput`](/api/credits-core/src/type-aliases/consumecreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### expireCredits()

> **expireCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`ExpireCreditsInput`](/api/credits-core/src/type-aliases/expirecreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### getAccount()

> **getAccount**(`accountId`): `Promise`\<[`CreditAccount`](/api/credits-core/src/type-aliases/creditaccount/) \| `null`\>

#### Parameters

##### accountId

[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

#### Returns

`Promise`\<[`CreditAccount`](/api/credits-core/src/type-aliases/creditaccount/) \| `null`\>

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

---

### grantCredits()

> **grantCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`GrantCreditsInput`](/api/credits-core/src/type-aliases/grantcreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### openAccount()

> **openAccount**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`OpenCreditAccountInput`](/api/credits-core/src/type-aliases/opencreditaccountinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### refundCredits()

> **refundCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`RefundCreditsInput`](/api/credits-core/src/type-aliases/refundcreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### releaseCredits()

> **releaseCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`ReleaseCreditsInput`](/api/credits-core/src/type-aliases/releasecreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

---

### reserveCredits()

> **reserveCredits**(`input`): `Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>

#### Parameters

##### input

[`ReserveCreditsInput`](/api/credits-core/src/type-aliases/reservecreditsinput/)

#### Returns

`Promise`\<[`CreditCommandResult`](/api/credits-core/src/type-aliases/creditcommandresult/)\>
