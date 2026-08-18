---
editUrl: false
next: false
prev: false
title: "Step"
---

## Type Parameters

### I

`I`

### O

`O`

## Constructors

### Constructor

> **new Step**\<`I`, `O`\>(`options`): `Step`\<`I`, `O`\>

#### Parameters

##### options

[`StepOptions`](/api/batch-core/src/interfaces/stepoptions/)\<`I`, `O`\>

#### Returns

`Step`\<`I`, `O`\>

## Properties

### chunkSize

> `readonly` **chunkSize**: `number`

---

### classifyFailure?

> `readonly` `optional` **classifyFailure?**: [`StepFailureClassifier`](/api/batch-core/src/type-aliases/stepfailureclassifier/)

---

### name

> `readonly` **name**: `string`

---

### processor?

> `readonly` `optional` **processor?**: [`ItemProcessor`](/api/batch-core/src/interfaces/itemprocessor/)\<`I`, `O`\>

---

### reader

> `readonly` **reader**: [`ItemReader`](/api/batch-core/src/interfaces/itemreader/)\<`I`\>

---

### writer

> `readonly` **writer**: [`ItemWriter`](/api/batch-core/src/interfaces/itemwriter/)\<`O`\>
