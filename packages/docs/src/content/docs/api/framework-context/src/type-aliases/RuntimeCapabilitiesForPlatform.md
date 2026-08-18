---
editUrl: false
next: false
prev: false
title: "RuntimeCapabilitiesForPlatform"
---

> **RuntimeCapabilitiesForPlatform**\<`TPlatform`\> = `TPlatform` _extends_ [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/) ? `{ readonly [TCapability in RuntimeCapabilityName]: RuntimeCapabilitySupportForPlatform<TPlatform>[TCapability] extends false ? false : boolean }` : `never`

## Type Parameters

### TPlatform

`TPlatform` _extends_ [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/)
