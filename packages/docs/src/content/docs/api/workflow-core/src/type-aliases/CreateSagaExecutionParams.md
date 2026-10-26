---
editUrl: false
next: false
prev: false
title: "CreateSagaExecutionParams"
---

> **CreateSagaExecutionParams** = `object`

## Properties

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string`

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### payload

> `readonly` **payload**: `unknown`

---

### replayOf?

> `readonly` `optional` **replayOf?**: `string`

---

### requestFingerprint?

> `readonly` `optional` **requestFingerprint?**: `string`

Versioned canonical name/payload identity; absent on legacy records.

---

### sagaName

> `readonly` **sagaName**: `string`
