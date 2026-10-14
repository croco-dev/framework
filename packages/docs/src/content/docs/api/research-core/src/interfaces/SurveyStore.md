---
editUrl: false
next: false
prev: false
title: "SurveyStore"
---

Implementations serialize a scope and roll back the whole callback on failure.

## Methods

### transaction()

> **transaction**\<`T`\>(`scope`, `callback`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

[`SurveyScope`](/api/research-core/src/type-aliases/surveyscope/)

##### callback

(`session`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
