---
editUrl: false
next: false
prev: false
title: "ControllerProject"
---

## Properties

### controllerSourceFiles

> `readonly` **controllerSourceFiles**: readonly `SourceFile`[]

---

### emitDir

> `readonly` **emitDir**: `string`

---

### project

> `readonly` **project**: `Project`

---

### sourceRoot

> `readonly` **sourceRoot**: `string`

---

### tsconfigPath

> `readonly` **tsconfigPath**: `string` \| `null`

## Methods

### dispose()

> **dispose**(): `void`

#### Returns

`void`

---

### emit()

> **emit**(): `void`

#### Returns

`void`

---

### getPreEmitDiagnostics()

> **getPreEmitDiagnostics**(): readonly `Diagnostic`\<`Diagnostic`\>[]

#### Returns

readonly `Diagnostic`\<`Diagnostic`\>[]

---

### importControllerModules()

> **importControllerModules**(): `Promise`\<readonly [`ControllerModule`](/api/protocol-codegen/src/type-aliases/controllermodule/)[]\>

#### Returns

`Promise`\<readonly [`ControllerModule`](/api/protocol-codegen/src/type-aliases/controllermodule/)[]\>

---

### importModule()

> **importModule**(`sourceFile`): `Promise`\<[`ControllerModule`](/api/protocol-codegen/src/type-aliases/controllermodule/)\>

#### Parameters

##### sourceFile

`SourceFile`

#### Returns

`Promise`\<[`ControllerModule`](/api/protocol-codegen/src/type-aliases/controllermodule/)\>
