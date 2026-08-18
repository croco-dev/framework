---
editUrl: false
next: false
prev: false
title: "PlanReleaseDiagnostic"
---

> **PlanReleaseDiagnostic** = `object`

## Properties

### code

> `readonly` **code**: `string`

***

### evidenceLevel

> `readonly` **evidenceLevel**: `"credential-free-structural"` \| `"remote-provider-preflight"`

***

### location

> `readonly` **location**: `object`

#### fieldId?

> `readonly` `optional` **fieldId?**: `string`

#### path

> `readonly` **path**: `string`

***

### message

> `readonly` **message**: `string`

***

### recovery

> `readonly` **recovery**: `object`

#### actionId?

> `readonly` `optional` **actionId?**: `string`

#### href?

> `readonly` `optional` **href?**: `string`

#### label

> `readonly` **label**: `string`

***

### severity

> `readonly` **severity**: `"error"` \| `"warning"`

***

### source

> `readonly` **source**: `"structural"` \| `"remote-provider"`
