---
editUrl: false
next: false
prev: false
title: "DesktopContractGraphCommand"
---

> **DesktopContractGraphCommand** = `object`

## Properties

### contractId

> `readonly` **contractId**: `string`

---

### effects

> `readonly` **effects**: readonly [`DesktopContractGraphEffect`](/api/protocols-desktop/src/type-aliases/desktopcontractgrapheffect/)[]

---

### events

> `readonly` **events**: readonly `string`[]

---

### executionPolicy

> `readonly` **executionPolicy**: `object`

#### maxConcurrency?

> `readonly` `optional` **maxConcurrency?**: `number`

#### maxInputBytes?

> `readonly` `optional` **maxInputBytes?**: `number`

#### maxOutputBytes?

> `readonly` `optional` **maxOutputBytes?**: `number`

#### mode

> `readonly` **mode**: `"request-response"`

#### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

---

### id

> `readonly` **id**: `string`

---

### input

> `readonly` **input**: [`DesktopContractGraphSchemaReference`](/api/protocols-desktop/src/type-aliases/desktopcontractgraphschemareference/)

---

### key

> `readonly` **key**: `string`

---

### kind

> `readonly` **kind**: `"query"` \| `"mutation"`

---

### output

> `readonly` **output**: [`DesktopContractGraphSchemaReference`](/api/protocols-desktop/src/type-aliases/desktopcontractgraphschemareference/)

---

### problems

> `readonly` **problems**: readonly `string`[]

---

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`DesktopWireSourceLocation`](/api/protocols-desktop/src/type-aliases/desktopwiresourcelocation/)
