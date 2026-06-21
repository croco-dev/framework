---
editUrl: false
next: false
prev: false
title: "ProblemBoundaryProps"
---

> **ProblemBoundaryProps** = `object`

## Properties

### children?

> `readonly` `optional` **children**: `ReactNode`

***

### fallback?

> `readonly` `optional` **fallback**: [`ProblemBoundaryFallback`](/api/frontend-react/src/type-aliases/problemboundaryfallback/)

***

### onProblem()?

> `readonly` `optional` **onProblem**: (`problem`, `error`, `errorInfo?`) => `void`

#### Parameters

##### problem

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

##### error

`unknown`

##### errorInfo?

`ErrorInfo`

#### Returns

`void`

***

### onReset()?

> `readonly` `optional` **onReset**: (`problem`) => `void`

#### Parameters

##### problem

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

#### Returns

`void`

***

### recoveryActions?

> `readonly` `optional` **recoveryActions**: readonly [`ProblemRecoveryAction`](/api/frontend-react/src/type-aliases/problemrecoveryaction/)[]

***

### resetKeys?

> `readonly` `optional` **resetKeys**: readonly `unknown`[]
