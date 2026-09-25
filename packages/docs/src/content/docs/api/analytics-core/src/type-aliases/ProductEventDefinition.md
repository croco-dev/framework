---
editUrl: false
next: false
prev: false
title: "ProductEventDefinition"
---

> **ProductEventDefinition**\<`S`\> = `object`

## Type Parameters

### S

`S` _extends_ [`ProductEventObjectSchema`](/api/analytics-core/src/type-aliases/producteventobjectschema/) = [`ProductEventObjectSchema`](/api/analytics-core/src/type-aliases/producteventobjectschema/)

## Properties

### description

> `readonly` **description**: `string`

---

### name

> `readonly` **name**: `string`

---

### occurrence

> `readonly` **occurrence**: [`ProductEventOccurrence`](/api/analytics-core/src/type-aliases/producteventoccurrence/)

---

### owner

> `readonly` **owner**: `string`

---

### properties

> `readonly` **properties**: `Readonly`\<`Record`\<keyof `S`\[`"properties"`\] & `string`, `string`\>\>

---

### schema

> `readonly` **schema**: `S`

---

### scope

> `readonly` **scope**: [`ProductEventScope`](/api/analytics-core/src/type-aliases/producteventscope/)

---

### sourceLocation

> `readonly` **sourceLocation**: `string`

---

### subjectKind

> `readonly` **subjectKind**: [`ProductEventSubjectKind`](/api/analytics-core/src/type-aliases/producteventsubjectkind/)

---

### version

> `readonly` **version**: `number`
