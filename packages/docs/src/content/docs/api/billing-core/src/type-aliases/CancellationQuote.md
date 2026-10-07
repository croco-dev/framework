---
editUrl: false
next: false
prev: false
title: "CancellationQuote"
---

> **CancellationQuote** = `object`

Values originate in the application/provider quote source; Croco performs no monetary calculation.

## Properties

### amount

> `readonly` **amount**: `string`

Non-negative decimal major currency units supplied by the authoritative quote source.

---

### currency

> `readonly` **currency**: `string`

---

### expiresAt

> `readonly` **expiresAt**: `string`

---

### ref

> `readonly` **ref**: `string`

---

### refund

> `readonly` **refund**: `"none"` \| `"partial"` \| `"full"`
