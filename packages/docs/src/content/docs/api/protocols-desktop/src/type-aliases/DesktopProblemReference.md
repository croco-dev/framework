---
editUrl: false
next: false
prev: false
title: "DesktopProblemReference"
---

> **DesktopProblemReference**\<`TProblem`, `TCode`, `TCategory`, `TExtensionsSchema`\> = `object`

## Type Parameters

### TProblem

`TProblem` _extends_ [`Problem`](/api/problems-core/src/classes/problem/) = [`Problem`](/api/problems-core/src/classes/problem/)

### TCode

`TCode` _extends_ `string` = `string`

### TCategory

`TCategory` _extends_ [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/) = [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

### TExtensionsSchema

`TExtensionsSchema` = `unknown`

## Properties

### category

> `readonly` **category**: `TCategory`

---

### code

> `readonly` **code**: `TCode`

---

### definitionType

> `readonly` **definitionType**: `"problem"`

---

### extensions?

> `readonly` `optional` **extensions?**: `TExtensionsSchema`

---

### problem

> `readonly` **problem**: [`DesktopProblemConstructor`](/api/protocols-desktop/src/type-aliases/desktopproblemconstructor/)\<`TProblem`\>
