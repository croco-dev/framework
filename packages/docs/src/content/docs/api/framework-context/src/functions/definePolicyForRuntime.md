---
editUrl: false
next: false
prev: false
title: "definePolicyForRuntime"
---

> **definePolicyForRuntime**\<`TPlatform`, `TPolicy`\>(`_preset`, `target`, `policy`, `options?`): [`PolicyDefinition`](/api/framework-context/src/type-aliases/policydefinition/)\<`TPolicy`\>

## Type Parameters

### TPlatform

`TPlatform` *extends* [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/)

### TPolicy

`TPolicy` *extends* [`RuntimePolicy`](/api/framework-context/src/type-aliases/runtimepolicy/)

## Parameters

### \_preset

[`RuntimePolicyPresetConfig`](/api/framework-context/src/type-aliases/runtimepolicypresetconfig/)\<`TPlatform`\>

### target

[`PolicyTarget`](/api/framework-context/src/type-aliases/policytarget/)

### policy

`TPolicy`

### options?

[`DefineRuntimePolicyOptions`](/api/framework-context/src/type-aliases/defineruntimepolicyoptions/)\<`TPlatform`\> = `{}`

## Returns

[`PolicyDefinition`](/api/framework-context/src/type-aliases/policydefinition/)\<`TPolicy`\>
