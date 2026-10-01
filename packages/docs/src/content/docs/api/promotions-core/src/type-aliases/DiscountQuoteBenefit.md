---
editUrl: false
next: false
prev: false
title: "DiscountQuoteBenefit"
---

> **DiscountQuoteBenefit** = `object`

Discount computed as pure Money math; provider fulfillment is quote-only.

## Properties

### currency

> `readonly` **currency**: `string`

ISO 4217 currency the charge must use; mixed currencies are rejected.

---

### kind

> `readonly` **kind**: `"discount-quote"`

---

### maxDiscount

> `readonly` **maxDiscount**: `object`

Cap expressed as Money JSON; currency must equal `currency`.

#### amount

> `readonly` **amount**: `number`

#### currency

> `readonly` **currency**: `string`

---

### percentBps

> `readonly` **percentBps**: `number`

Integer basis points in 1..10000 (10000 = 100%).

---

### supportedProviders

> `readonly` **supportedProviders**: readonly `string`[]

Providers whose discount feature is actually implemented. An empty list
means provider fulfillment is unsupported: quotes stay informational and
reservation is refused instead of pretending the discount exists.
