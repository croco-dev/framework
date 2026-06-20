---
editUrl: false
next: false
prev: false
title: "PolicyCapabilityDiagnostic"
---

> **PolicyCapabilityDiagnostic** = `object`

## Properties

### capability

> `readonly` **capability**: [`PolicyRuntimeCapability`](/api/framework-context/src/type-aliases/policyruntimecapability/)

***

### code

> `readonly` **code**: *typeof* [`POLICY_CAPABILITY_UNAVAILABLE_CODE`](/api/framework-context/src/variables/policy_capability_unavailable_code/)

***

### message

> `readonly` **message**: `string`

***

### policyKind

> `readonly` **policyKind**: [`PolicyKind`](/api/framework-context/src/type-aliases/policykind/)

***

### runtimeSource?

> `readonly` `optional` **runtimeSource**: [`PolicySource`](/api/framework-context/src/type-aliases/policysource/)

***

### severity

> `readonly` **severity**: `"error"`

***

### source?

> `readonly` `optional` **source**: [`PolicySource`](/api/framework-context/src/type-aliases/policysource/)

***

### target

> `readonly` **target**: [`PolicyTarget`](/api/framework-context/src/type-aliases/policytarget/)

***

### targetRuntime?

> `readonly` `optional` **targetRuntime**: [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/)
