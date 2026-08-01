---
editUrl: false
next: false
prev: false
title: "MonetizationSignalEvidenceByType"
---

> **MonetizationSignalEvidenceByType** = `object`

## Properties

### billing.credit.balance\_low

> `readonly` **billing.credit.balance\_low**: `object`

#### balance

> `readonly` **balance**: `number`

#### threshold

> `readonly` **threshold**: `number`

#### unit

> `readonly` **unit**: `string`

***

### billing.credit.exhausted

> `readonly` **billing.credit.exhausted**: `object`

#### balance

> `readonly` **balance**: `number`

#### unit

> `readonly` **unit**: `string`

***

### billing.seat.quantity\_drifted

> `readonly` **billing.seat.quantity\_drifted**: `object`

#### difference

> `readonly` **difference**: `number`

#### expectedQuantity

> `readonly` **expectedQuantity**: `number`

#### observedQuantity

> `readonly` **observedQuantity**: `number`

***

### billing.subscription.past\_due

> `readonly` **billing.subscription.past\_due**: `object`

#### attemptCount

> `readonly` **attemptCount**: `number`

***

### billing.subscription.recovered

> `readonly` **billing.subscription.recovered**: `object`

#### recovered

> `readonly` **recovered**: `boolean`

***

### billing.trial.ending

> `readonly` **billing.trial.ending**: `object`

#### daysRemaining

> `readonly` **daysRemaining**: `number`

#### trialEndsAt

> `readonly` **trialEndsAt**: `string`

***

### billing.usage.delivery\_lagging

> `readonly` **billing.usage.delivery\_lagging**: `object`

#### meterKey

> `readonly` **meterKey**: `string`

#### oldestPendingAt

> `readonly` **oldestPendingAt**: `string`

#### pendingRecordCount

> `readonly` **pendingRecordCount**: `number`

#### periodEndsAt

> `readonly` **periodEndsAt**: `string`

***

### billing.usage.sync\_drifted

> `readonly` **billing.usage.sync\_drifted**: `object`

#### difference

> `readonly` **difference**: `number`

#### localRecorded

> `readonly` **localRecorded**: `number`

#### meterKey

> `readonly` **meterKey**: `string`

#### periodEndsAt

> `readonly` **periodEndsAt**: `string`

#### periodStartsAt

> `readonly` **periodStartsAt**: `string`

#### tolerance

> `readonly` **tolerance**: `number`

#### upstreamObserved

> `readonly` **upstreamObserved**: `number`

***

### billing.usage.threshold\_crossed

> `readonly` **billing.usage.threshold\_crossed**: `object`

#### consumed

> `readonly` **consumed**: `number`

#### limit

> `readonly` **limit**: `number`

#### meterKey

> `readonly` **meterKey**: `string`

#### periodEndsAt

> `readonly` **periodEndsAt**: `string`

#### periodStartsAt

> `readonly` **periodStartsAt**: `string`

#### ratio

> `readonly` **ratio**: `number`

#### threshold

> `readonly` **threshold**: `number`
