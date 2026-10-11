---
editUrl: false
next: false
prev: false
title: "TrialCreditBenefit"
---

> **TrialCreditBenefit** = `object`

Trial credit grant paid through the existing credit ledger.

## Properties

### creditAmount

> `readonly` **creditAmount**: `string`

Canonical base-10 offer amount string (at most 18 fraction digits).

---

### expiresAt?

> `readonly` `optional` **expiresAt?**: `Date`

Optional grant expiry; never refreshed by re-reading the offer.

---

### kind

> `readonly` **kind**: `"trial-credits"`

---

### walletKey?

> `readonly` `optional` **walletKey?**: `string`

Wallet the grant lands in; resolved to a validated mapped ledger account.
