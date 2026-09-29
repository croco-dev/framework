---
editUrl: false
next: false
prev: false
title: "fingerprintLifecycleSourcePayload"
---

> **fingerprintLifecycleSourcePayload**(`signal`): `string`

Canonical semantic payload fingerprint used only for conflict checks.
Identity is never derived from this value: receiver timestamps and attempt
metadata are excluded, while semantic `data` differences change the hash.

## Parameters

### signal

[`LifecycleSignal`](/api/lifecycle-core/src/type-aliases/lifecyclesignal/)

## Returns

`string`
