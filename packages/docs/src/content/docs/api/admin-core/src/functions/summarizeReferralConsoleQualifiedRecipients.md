---
editUrl: false
next: false
prev: false
title: "summarizeReferralConsoleQualifiedRecipients"
---

> **summarizeReferralConsoleQualifiedRecipients**(`input`): `object`

Operator view of qualified recipients plus the next share cycle. Never discloses raw subject ids.

## Parameters

### input

#### attributions

readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]

#### grantedPermissions

readonly `string`[]

#### nextShareCycle

`string`

## Returns

`object`

### nextShareCycle

> `readonly` **nextShareCycle**: `string`

### qualified

> `readonly` **qualified**: readonly [`ReferralConsoleQualifiedRecipient`](/api/admin-core/src/type-aliases/referralconsolequalifiedrecipient/)[]
