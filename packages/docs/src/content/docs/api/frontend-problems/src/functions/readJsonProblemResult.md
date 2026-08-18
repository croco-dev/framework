---
editUrl: false
next: false
prev: false
title: "readJsonProblemResult"
---

> **readJsonProblemResult**\<`T`, `Problem`\>(`response`, `declaredProblems?`): `Promise`\<[`ProblemResult`](/api/frontend-problems/src/type-aliases/problemresult/)\<`T`, `Problem`\>\>

## Type Parameters

### T

`T` = `unknown`

### Problem

`Problem` _extends_ [`ProblemDeclaration`](/api/frontend-problems/src/type-aliases/problemdeclaration/)\<`string`, `string`, `number`\> = [`ProblemDeclaration`](/api/frontend-problems/src/type-aliases/problemdeclaration/)\<`string`, `string`, `number`\>

## Parameters

### response

`Response`

### declaredProblems?

readonly `Problem`[] = `[]`

## Returns

`Promise`\<[`ProblemResult`](/api/frontend-problems/src/type-aliases/problemresult/)\<`T`, `Problem`\>\>
