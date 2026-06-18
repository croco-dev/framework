---
editUrl: false
next: false
prev: false
title: "RuntimeInspector"
---

## Constructors

### Constructor

> **new RuntimeInspector**(`options?`): `RuntimeInspector`

#### Parameters

##### options?

[`RuntimeInspectorOptions`](/api/framework-context/src/type-aliases/runtimeinspectoroptions/) = `{}`

#### Returns

`RuntimeInspector`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### finishRequest()

> **finishRequest**(`input`): [`RuntimeInspectionRecord`](/api/framework-context/src/type-aliases/runtimeinspectionrecord/) \| `undefined`

#### Parameters

##### input

[`RuntimeInspectorRequestFinish`](/api/framework-context/src/type-aliases/runtimeinspectorrequestfinish/)

#### Returns

[`RuntimeInspectionRecord`](/api/framework-context/src/type-aliases/runtimeinspectionrecord/) \| `undefined`

***

### recordEvent()

> **recordEvent**(`input`): `void`

#### Parameters

##### input

[`RuntimeInspectorEventInput`](/api/framework-context/src/type-aliases/runtimeinspectoreventinput/)

#### Returns

`void`

***

### snapshot()

> **snapshot**(): [`RuntimeInspectorSnapshot`](/api/framework-context/src/type-aliases/runtimeinspectorsnapshot/)

#### Returns

[`RuntimeInspectorSnapshot`](/api/framework-context/src/type-aliases/runtimeinspectorsnapshot/)

***

### startRequest()

> **startRequest**(`input`): [`RuntimeInspectionRecord`](/api/framework-context/src/type-aliases/runtimeinspectionrecord/)

#### Parameters

##### input

[`RuntimeInspectorRequestStart`](/api/framework-context/src/type-aliases/runtimeinspectorrequeststart/)

#### Returns

[`RuntimeInspectionRecord`](/api/framework-context/src/type-aliases/runtimeinspectionrecord/)
