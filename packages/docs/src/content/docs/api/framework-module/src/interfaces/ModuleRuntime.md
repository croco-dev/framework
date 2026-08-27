---
editUrl: false
next: false
prev: false
title: "ModuleRuntime"
---

## Extends

- `AsyncDisposable`

## Methods

### \[asyncDispose\]()

> **\[asyncDispose\]**(): `PromiseLike`\<`void`\>

#### Returns

`PromiseLike`\<`void`\>

#### Inherited from

`AsyncDisposable.[asyncDispose]`

---

### createGraphManifest()

> **createGraphManifest**(): [`ModuleGraphManifest`](/api/framework-module/src/type-aliases/modulegraphmanifest/)

#### Returns

[`ModuleGraphManifest`](/api/framework-module/src/type-aliases/modulegraphmanifest/)

---

### dispose()

> **dispose**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### getRegisteredModules()

> **getRegisteredModules**(): readonly [`ModuleDiagnosticsSnapshot`](/api/framework-module/src/type-aliases/modulediagnosticssnapshot/)[]

#### Returns

readonly [`ModuleDiagnosticsSnapshot`](/api/framework-module/src/type-aliases/modulediagnosticssnapshot/)[]

---

### initialize()

> **initialize**(): `Promise`\<[`ModuleContext`](/api/framework-module/src/classes/modulecontext/)\>

#### Returns

`Promise`\<[`ModuleContext`](/api/framework-module/src/classes/modulecontext/)\>

---

### reset()

> **reset**(): `void`

#### Returns

`void`

---

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### use()

> **use**(`module`): `void`

#### Parameters

##### module

[`ModuleOptions`](/api/framework-module/src/type-aliases/moduleoptions/)

#### Returns

`void`
