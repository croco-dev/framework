---
editUrl: false
next: false
prev: false
title: "MonetizationSignalMetadataByType"
---

> **MonetizationSignalMetadataByType** = `object`

## Properties

### billing.credit.balance_low

> `readonly` **billing.credit.balance_low**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef?

> `readonly` `optional` **planVersionRef?**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"credit_balance_low"`

#### status

> `readonly` **status**: `"low"`

---

### billing.credit.exhausted

> `readonly` **billing.credit.exhausted**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef?

> `readonly` `optional` **planVersionRef?**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"credit_exhausted"`

#### status

> `readonly` **status**: `"exhausted"`

---

### billing.seat.quantity_drifted

> `readonly` **billing.seat.quantity_drifted**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"seat_quantity_mismatch"`

#### status

> `readonly` **status**: `"drifted"`

---

### billing.subscription.past_due

> `readonly` **billing.subscription.past_due**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"payment_failed"` \| `"payment_action_required"`

#### status

> `readonly` **status**: `"past_due"`

---

### billing.subscription.recovered

> `readonly` **billing.subscription.recovered**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"subscription_recovered"`

#### recoveryOf

> `readonly` **recoveryOf**: `string`

#### status

> `readonly` **status**: `"recovered"`

---

### billing.trial.ending

> `readonly` **billing.trial.ending**: `object`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"trial_end_approaching"`

#### status

> `readonly` **status**: `"ending"`

---

### billing.usage.delivery_lagging

> `readonly` **billing.usage.delivery_lagging**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"delivery_backlog"`

#### status

> `readonly` **status**: `"lagging"`

---

### billing.usage.sync_drifted

> `readonly` **billing.usage.sync_drifted**: `object`

#### conditionId

> `readonly` **conditionId**: `string`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"usage_mismatch"`

#### status

> `readonly` **status**: `"drifted"`

---

### billing.usage.threshold_crossed

> `readonly` **billing.usage.threshold_crossed**: `object`

#### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### reason

> `readonly` **reason**: `"usage_threshold_crossed"`

#### status

> `readonly` **status**: `"crossed"`
