---
editUrl: false
next: false
prev: false
title: "ReferralProgramDefinition"
---

> **ReferralProgramDefinition** = `object`

## Properties

### actorId

> `readonly` **actorId**: `string`

---

### attributionPolicy

> `readonly` **attributionPolicy**: `"first-valid"`

First qualifying action wins the attribution; later claims are held, not merged.

---

### benefitCycleId

> `readonly` **benefitCycleId**: `string`

Explicit benefit cycle id. A fresh allowance always requires a new explicit
cycle id; changing `version` alone never resets per-subject counts.

---

### budgetPerAttribution

> `readonly` **budgetPerAttribution**: `string`

Maximum face amount a single attribution may reserve.

---

### budgetTotal

> `readonly` **budgetTotal**: `string`

Total reservable budget in benefit units for this program version.

---

### conversionWindowMs

> `readonly` **conversionWindowMs**: `number`

Conversion window after claim inside which qualification still counts.

---

### endsAt

> `readonly` **endsAt**: `Date`

---

### familyId

> `readonly` **familyId**: `string`

Program family; defaults to `id`. Receipt limits never reset on revision alone.

---

### id

> `readonly` **id**: `string`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### perSubjectLimit

> `readonly` **perSubjectLimit**: `number`

Required per-subject receipt limit; unlimited is never implied.

---

### qualifyingAction

> `readonly` **qualifyingAction**: `string`

Required qualifying action reported by an authoritative server source.

---

### reason

> `readonly` **reason**: `string`

---

### recipientBenefit

> `readonly` **recipientBenefit**: [`ReferralBenefit`](/api/referral-core/src/type-aliases/referralbenefit/)

---

### referrerBenefit

> `readonly` **referrerBenefit**: [`ReferralBenefit`](/api/referral-core/src/type-aliases/referralbenefit/)

---

### registeredAt

> `readonly` **registeredAt**: `Date`

---

### startsAt

> `readonly` **startsAt**: `Date`

---

### version

> `readonly` **version**: `number`

Integer program version; links and attributions pin the version they used.
