---
editUrl: false
next: false
prev: false
title: "StepOptions"
---

## Type Parameters

### I

`I`

### O

`O`

## Properties

### chunkSize?

> `optional` **chunkSize?**: `number`

***

### classifyFailure?

> `optional` **classifyFailure?**: [`StepFailureClassifier`](/api/batch-core/src/type-aliases/stepfailureclassifier/)

***

### name

> **name**: `string`

***

### processor?

> `optional` **processor?**: [`ItemProcessor`](/api/batch-core/src/interfaces/itemprocessor/)\<`I`, `O`\>

***

### reader

> **reader**: [`ItemReader`](/api/batch-core/src/interfaces/itemreader/)\<`I`\>

***

### writer

> **writer**: [`ItemWriter`](/api/batch-core/src/interfaces/itemwriter/)\<`O`\>
