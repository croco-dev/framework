---
editUrl: false
next: false
prev: false
title: "readProblemErrorResult"
---

> **readProblemErrorResult**\<`Problem`\>(`response`, `declaredProblems?`): `Promise`\<[`ProblemClientExternalFailure`](/api/frontend-problems/src/type-aliases/problemclientexternalfailure/) \| [`ProblemFetchProblemFailure`](/api/frontend-problems/src/type-aliases/problemfetchproblemfailure/)\<`Problem`\>\>

## Type Parameters

### Problem

`Problem` _extends_ [`ProblemDeclaration`](/api/frontend-problems/src/type-aliases/problemdeclaration/)\<`string`, `string`, `number`\> = [`ProblemDeclaration`](/api/frontend-problems/src/type-aliases/problemdeclaration/)\<`string`, `string`, `number`\>

## Parameters

### response

`Response`

### declaredProblems?

readonly `Problem`[] = `[]`

## Returns

`Promise`\<[`ProblemClientExternalFailure`](/api/frontend-problems/src/type-aliases/problemclientexternalfailure/) \| [`ProblemFetchProblemFailure`](/api/frontend-problems/src/type-aliases/problemfetchproblemfailure/)\<`Problem`\>\>
