---
editUrl: false
next: false
prev: false
title: "registerReferralProgram"
---

> **registerReferralProgram**(`input`, `now?`): [`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/)

Registers a referral program in code. Limits are mandatory, amounts are
canonicalized, and the returned document is a frozen snapshot: later
registrations never mutate confirmed links, attributions, or benefits.

## Parameters

### input

[`RegisterReferralProgramInput`](/api/referral-core/src/type-aliases/registerreferralprograminput/)

### now?

`Date` = `...`

## Returns

[`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/)
