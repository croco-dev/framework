---
editUrl: false
next: false
prev: false
title: "DefineRuntimeEnvOptions"
---

> **DefineRuntimeEnvOptions**\<`TPresets`, `TPrefix`\> = `object` & \[`TPrefix`\] _extends_ \[`"NEXT_PUBLIC_"`\] ? `object` : `object`

## Type Declaration

### presets

> `readonly` **presets**: `number` _extends_ `TPresets`\[`"length"`\] ? `never` : `TPresets` & `RuntimeEnvBoundaryValidation`\<`TPresets`, `NoInfer`\<`TPrefix`\>\>

## Type Parameters

### TPresets

`TPresets` _extends_ readonly [`RuntimeEnvPreset`](/api/framework-config/src/type-aliases/runtimeenvpreset/)[]

### TPrefix

`TPrefix` _extends_ `string` = `"NEXT_PUBLIC_"`
