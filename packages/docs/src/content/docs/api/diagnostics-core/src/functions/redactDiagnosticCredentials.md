---
editUrl: false
next: false
prev: false
title: "redactDiagnosticCredentials"
---

> **redactDiagnosticCredentials**(`message`, `sensitiveKey`, `replacement?`): `string`

Masks credential fields in diagnostic text. The caller supplies its sensitive-key policy
and handles any known secret values that appear without a field name.

## Parameters

### message

`string`

### sensitiveKey

`RegExp`

### replacement?

`string` = `"[redacted]"`

## Returns

`string`
