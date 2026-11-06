---
editUrl: false
next: false
prev: false
title: "PlaywrightTestCase"
---

> **PlaywrightTestCase** = `object`

## Properties

### expectedStatus?

> `readonly` `optional` **expectedStatus?**: [`PlaywrightTestResult`](/api/testing/src/type-aliases/playwrighttestresult/)\[`"status"`\]

---

### id

> `readonly` **id**: `string`

---

### location?

> `readonly` `optional` **location?**: `object`

#### file

> `readonly` **file**: `string`

#### line?

> `readonly` `optional` **line?**: `number`

---

### parent?

> `readonly` `optional` **parent?**: `object`

#### project

> `readonly` **project**: () => \{ `name`: `string`; `testDir`: `string`; \} \| `undefined`

##### Returns

\{ `name`: `string`; `testDir`: `string`; \} \| `undefined`

---

### tags?

> `readonly` `optional` **tags?**: readonly `string`[]

---

### title

> `readonly` **title**: `string`

---

### titlePath?

> `readonly` `optional` **titlePath?**: () => readonly `string`[]

#### Returns

readonly `string`[]
