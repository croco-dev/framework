---
editUrl: false
next: false
prev: false
title: "RestControllerSourceProblems"
---

> **RestControllerSourceProblems** = `object`

## Properties

### controllerTypeScriptDiagnostics

> `readonly` **controllerTypeScriptDiagnostics**: (`controllerPatterns`, `diagnostics`) => [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### controllerPatterns

`string`

##### diagnostics

readonly [`ControllerTypeScriptDiagnostic`](/api/protocol-codegen/src/type-aliases/controllertypescriptdiagnostic/)[]

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

---

### noControllersFound

> `readonly` **noControllersFound**: (`controllerPatterns`) => [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### controllerPatterns

`string`

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)
