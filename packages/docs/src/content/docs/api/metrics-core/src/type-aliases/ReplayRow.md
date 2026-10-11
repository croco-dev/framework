---
editUrl: false
next: false
prev: false
title: "ReplayRow"
---

> **ReplayRow** = `object`

## Properties

### atDecision

> `readonly` **atDecision**: `string`

---

### cost?

> `readonly` `optional` **cost?**: `object`

#### amount

> `readonly` **amount**: `number`

#### currency

> `readonly` **currency**: `string`

---

### dispatch?

> `readonly` `optional` **dispatch?**: `object`

#### at

> `readonly` **at**: `string`

#### dispatchId

> `readonly` **dispatchId**: `string`

---

### outcomes?

> `readonly` `optional` **outcomes?**: readonly (\{ `at`: `string`; `eventId`: `string`; `kind`: `"visit"`; \} \| \{ `amount`: `number`; `at`: `string`; `currency`: `string`; `eventId`: `string`; `kind`: `"financial"`; \})[]

---

### subjectId

> `readonly` **subjectId**: `string`

---

### touchpoints?

> `readonly` `optional` **touchpoints?**: readonly `object`[]

---

### traitsAtDecision?

> `readonly` `optional` **traitsAtDecision?**: `Readonly`\<`Record`\<`string`, `Scalar`\>\>
