---
editUrl: false
next: false
prev: false
title: "ModelBinding"
---

> **ModelBinding** = `object` & \{ `backend`: `"postgres"`; \} \| \{ `backend`: `"external"`; `schema`: `string`; `table`: `string`; \}

## Type Declaration

### connection

> `readonly` **connection**: `string`

### fact

> `readonly` **fact**: [`FactDeclaration`](/api/warehouse-core/src/type-aliases/factdeclaration/)

### location

> `readonly` **location**: [`SourceLocation`](/api/warehouse-tooling/src/type-aliases/sourcelocation/)
