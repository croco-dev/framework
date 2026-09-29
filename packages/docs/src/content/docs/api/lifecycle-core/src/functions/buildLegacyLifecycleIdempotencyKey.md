---
editUrl: false
next: false
prev: false
title: "buildLegacyLifecycleIdempotencyKey"
---

> **buildLegacyLifecycleIdempotencyKey**(`input`): `string`

Legacy default key issued before source identity became mandatory.
Accepted for one release as a migration fallback; new claims never issue it.

## Parameters

### input

#### occurredAt

`Date`

#### ruleId

`string`

#### ruleVersion

`string`

#### signalId?

`string`

#### signalType

`string`

#### tenantId

`string`

## Returns

`string`
