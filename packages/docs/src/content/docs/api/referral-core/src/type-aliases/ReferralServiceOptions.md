---
editUrl: false
next: false
prev: false
title: "ReferralServiceOptions"
---

> **ReferralServiceOptions** = `object`

## Properties

### clock?

> `readonly` `optional` **clock?**: () => `Date`

#### Returns

`Date`

---

### fulfillment

> `readonly` **fulfillment**: [`ReferralFulfillmentPort`](/api/referral-core/src/interfaces/referralfulfillmentport/)

Benefit boundary; per-side deterministic idempotency, partial success allowed.

---

### idGenerator?

> `readonly` `optional` **idGenerator?**: () => `string`

#### Returns

`string`

---

### linkTtlMs?

> `readonly` `optional` **linkTtlMs?**: `number`

---

### novelty?

> `readonly` `optional` **novelty?**: [`ReferralNoveltyHook`](/api/referral-core/src/type-aliases/referralnoveltyhook/)

Authoritative signup novelty source owned by the app.

---

### qualification?

> `readonly` `optional` **qualification?**: [`ReferralQualificationHook`](/api/referral-core/src/type-aliases/referralqualificationhook/)

Authoritative qualifying-action source owned by the app.

---

### store

> `readonly` **store**: [`ReferralStore`](/api/referral-core/src/interfaces/referralstore/)

---

### tokens

> `readonly` **tokens**: [`ReferralTokenHooks`](/api/referral-core/src/type-aliases/referraltokenhooks/)

Server-only token hooks; raw tokens never persist and never log.
