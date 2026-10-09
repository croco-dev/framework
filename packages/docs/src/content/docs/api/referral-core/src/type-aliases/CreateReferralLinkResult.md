---
editUrl: false
next: false
prev: false
title: "CreateReferralLinkResult"
---

> **CreateReferralLinkResult** = `object`

## Properties

### link

> `readonly` **link**: [`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)

Durable link row; never carries the raw token.

---

### token

> `readonly` **token**: `string`

Raw token returned once to the caller for sharing; never persisted.
