---
editUrl: false
next: false
prev: false
title: "ClaimReferralResult"
---

> **ClaimReferralResult** = `object`

## Properties

### attribution

> `readonly` **attribution**: [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)

---

### created

> `readonly` **created**: `boolean`

False when the same attribution id replayed an identical claim.

---

### firstValid

> `readonly` **firstValid**: `boolean`

True when this claim won the first-valid race; false when held as duplicate.
