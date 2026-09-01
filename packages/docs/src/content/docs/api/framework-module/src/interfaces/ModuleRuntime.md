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

### getContributions()

> **getContributions**\<`T`, `TKind`\>(`kind`): readonly [`ResolvedModuleContribution`](/api/framework-module/src/type-aliases/resolvedmodulecontribution/)\<`T`, `TKind`\>[]

#### Type Parameters

##### T

`T`

##### TKind

`TKind` _extends_ `string` = `string`

#### Parameters

##### kind

`TKind`

#### Returns

readonly [`ResolvedModuleContribution`](/api/framework-module/src/type-aliases/resolvedmodulecontribution/)\<`T`, `TKind`\>[]

---

### getRegisteredModules()

> **getRegisteredModules**(): readonly [`ModuleDiagnosticsSnapshot`](/api/framework-module/src/type-aliases/modulediagnosticssnapshot/)[]

#### Returns

readonly [`ModuleDiagnosticsSnapshot`](/api/framework-module/src/type-aliases/modulediagnosticssnapshot/)[]

---

### initialize()

> **initialize**(`options?`): `Promise`\<[`ModuleContext`](/api/framework-module/src/classes/modulecontext/)\>

#### Parameters

##### options?

[`ModuleLifecycleExecutionOptions`](/api/framework-module/src/type-aliases/modulelifecycleexecutionoptions/)

#### Returns

`Promise`\<[`ModuleContext`](/api/framework-module/src/classes/modulecontext/)\>

---

### reset()

> **reset**(): `void`

#### Returns

`void`

---

### shutdown()

> **shutdown**(`options?`): `Promise`\<`void`\>

#### Parameters

##### options?

[`ModuleLifecycleExecutionOptions`](/api/framework-module/src/type-aliases/modulelifecycleexecutionoptions/)

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
