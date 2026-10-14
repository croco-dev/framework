---
editUrl: false
next: false
prev: false
title: "DrizzleSurveyStore"
---

The scope lock orders all survey mutations, including frequency claims across versions.

## Implements

- [`SurveyStore`](/api/research-core/src/interfaces/surveystore/)

## Constructors

### Constructor

> **new DrizzleSurveyStore**(`db`): `DrizzleSurveyStore`

#### Parameters

##### db

[`DrizzleSurveyClient`](/api/research-drizzle/src/type-aliases/drizzlesurveyclient/)

#### Returns

`DrizzleSurveyStore`

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

#### Implementation of

[`SurveyStore`](/api/research-core/src/interfaces/surveystore/).[`transaction`](/api/research-core/src/interfaces/surveystore/#transaction)
