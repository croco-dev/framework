---
editUrl: false
next: false
prev: false
title: "ReferralAttribution"
---

> **ReferralAttribution** = `object`

## Properties

### benefitCycleId

> `readonly` **benefitCycleId**: `string`

---

### claimedAt

> `readonly` **claimedAt**: `Date`

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### cycleIndex

> `readonly` **cycleIndex**: `number`

---

### expiresAt

> `readonly` **expiresAt**: `Date`

---

### familyId

> `readonly` **familyId**: `string`

---

### holdReason?

> `readonly` `optional` **holdReason?**: [`ReferralAttributionHoldReason`](/api/referral-core/src/type-aliases/referralattributionholdreason/)

---

### id

> `readonly` **id**: `string`

---

### linkId

> `readonly` **linkId**: `string`

---

### programId

> `readonly` **programId**: `string`

---

### programVersion

> `readonly` **programVersion**: `number`

---

### qualification?

> `readonly` `optional` **qualification?**: `object`

Authoritative qualification evidence; present once qualified.

#### eligibleReason

> `readonly` **eligibleReason**: `string`

#### qualifiedAt

> `readonly` **qualifiedAt**: `Date`

#### qualifyingAction

> `readonly` **qualifyingAction**: `string`

#### sourceEventId

> `readonly` **sourceEventId**: `string`

---

### recipient?

> `readonly` `optional` **recipient?**: [`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

Present once the recipient is known; absent while the link is only shared.

---

### referrer

> `readonly` **referrer**: [`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

---

### rejectReason?

> `readonly` `optional` **rejectReason?**: [`ReferralAttributionRejectReason`](/api/referral-core/src/type-aliases/referralattributionrejectreason/)

---

### scope

> `readonly` **scope**: [`ReferralScope`](/api/referral-core/src/type-aliases/referralscope/)

---

### state

> `readonly` **state**: [`ReferralAttributionState`](/api/referral-core/src/type-aliases/referralattributionstate/)

---

### updatedAt

> `readonly` **updatedAt**: `Date`
