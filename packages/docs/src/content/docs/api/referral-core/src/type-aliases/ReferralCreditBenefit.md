---
editUrl: false
next: false
prev: false
title: "ReferralCreditBenefit"
---

> **ReferralCreditBenefit** = `object`

Trial credit grant paid through the existing credit ledger.

## Properties

### creditAmount

> `readonly` **creditAmount**: `string`

Canonical base-10 amount string (at most 18 fraction digits).

---

### expiresAt?

> `readonly` `optional` **expiresAt?**: `Date`

Optional grant expiry; never refreshed by re-reading the program.

---

### kind

> `readonly` **kind**: `"trial-credits"`

---

### walletKey?

> `readonly` `optional` **walletKey?**: `string`

Wallet the grant lands in; resolved to a validated mapped ledger account.
