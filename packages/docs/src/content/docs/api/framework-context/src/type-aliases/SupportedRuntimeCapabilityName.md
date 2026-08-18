---
editUrl: false
next: false
prev: false
title: "SupportedRuntimeCapabilityName"
---

> **SupportedRuntimeCapabilityName**\<`TPlatform`\> = `{ readonly [TCapability in RuntimeCapabilityName]: RuntimeCapabilitySupportForPlatform<TPlatform>[TCapability] extends false ? never : TCapability }`\[[`RuntimeCapabilityName`](/api/framework-context/src/type-aliases/runtimecapabilityname/)\]

## Type Parameters

### TPlatform

`TPlatform` *extends* [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/)
