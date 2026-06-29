---
editUrl: false
next: false
prev: false
title: "fetchProblemJson"
---

> **fetchProblemJson**\<`T`, `Problem`\>(`input`, `init?`, `options?`): `Promise`\<[`ProblemResult`](/api/frontend-problems/src/type-aliases/problemresult/)\<`T`, `Problem`\>\>

## Type Parameters

### T

`T` = `unknown`

### Problem

`Problem` *extends* [`ProblemDeclaration`](/api/frontend-problems/src/type-aliases/problemdeclaration/)\<`string`, `string`, `number`\> = [`ProblemDeclaration`](/api/frontend-problems/src/type-aliases/problemdeclaration/)\<`string`, `string`, `number`\>

## Parameters

### input

`RequestInfo` \| `URL`

### init?

`RequestInit`

### options?

[`ProblemFetchOptions`](/api/frontend-problems/src/type-aliases/problemfetchoptions/)\<`Problem`\> = `{}`

## Returns

`Promise`\<[`ProblemResult`](/api/frontend-problems/src/type-aliases/problemresult/)\<`T`, `Problem`\>\>
