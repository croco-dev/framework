---
editUrl: false
next: false
prev: false
title: "EnrichmentOperations"
---

Server operations resolve principal/scope from the request, never from browser fields.

## Constructors

### Constructor

> **new EnrichmentOperations**(`service`, `options`): `EnrichmentOperations`

#### Parameters

##### service

`EnrichmentService`

##### options

###### context

() => `Promise`\<\{ `actor`: `string`; `scope`: `EnrichmentScope`; \}\>

###### definitionId

`string`

###### versions

readonly `string`[]

#### Returns

`EnrichmentOperations`

## Methods

### classify()

> **classify**(`runId`, `itemId`, `version`, `signal?`): `Promise`\<`EnrichmentPage`\>

#### Parameters

##### runId

`string`

##### itemId

`string`

##### version

`string`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`EnrichmentPage`\>

---

### enqueue()

> **enqueue**(`runId`, `inputs`, `limits`, `retention`): `Promise`\<`EnrichmentPage`\>

#### Parameters

##### runId

`string`

##### inputs

readonly `EnrichmentInput`[]

##### limits

`ClassificationLimits`

##### retention

###### rawMs

`number`

###### resultMs

`number`

#### Returns

`Promise`\<`EnrichmentPage`\>

---

### exportLabels()

> **exportLabels**(`runId`, `input`): `Promise`\<readonly `object`[]\>

#### Parameters

##### runId

`string`

##### input

###### expectedRevision

`number`

###### idempotencyKey

`string`

###### reason

`string`

###### version

`string`

#### Returns

`Promise`\<readonly `object`[]\>

---

### read()

> **read**(`runId`, `offset?`): `Promise`\<`EnrichmentPage`\>

#### Parameters

##### runId

`string`

##### offset?

`number` = `0`

#### Returns

`Promise`\<`EnrichmentPage`\>

---

### retry()

> **retry**(`runId`, `input`): `Promise`\<`EnrichmentPage`\>

#### Parameters

##### runId

`string`

##### input

###### acknowledgeDuplicateBilling

`boolean`

###### expectedRevision

`number`

###### idempotencyKey

`string`

###### itemId

`string`

###### reason

`string`

###### receiptId

`string`

#### Returns

`Promise`\<`EnrichmentPage`\>

---

### review()

> **review**(`runId`, `input`): `Promise`\<`EnrichmentPage`\>

#### Parameters

##### runId

`string`

##### input

###### evidence

`string`

###### expectedRevision

`number`

###### idempotencyKey

`string`

###### itemId

`string`

###### labelId

`string`

###### reason

`string`

###### version

`string`

#### Returns

`Promise`\<`EnrichmentPage`\>

---

### settle()

> **settle**(`runId`): `Promise`\<`EnrichmentPage`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`EnrichmentPage`\>
