---
editUrl: false
next: false
prev: false
title: "ProblemPanelProps"
---

> **ProblemPanelProps** = `object`

## Properties

### problem

> `readonly` **problem**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### recoveryActions?

> `readonly` `optional` **recoveryActions?**: readonly [`ProblemRecoveryAction`](/api/frontend-react/src/type-aliases/problemrecoveryaction/)[]

---

### renderProblem?

> `readonly` `optional` **renderProblem?**: (`problem`) => `ReactNode`

#### Parameters

##### problem

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

#### Returns

`ReactNode`

---

### renderRecoveryAction?

> `readonly` `optional` **renderRecoveryAction?**: (`action`, `problem`) => `ReactNode`

#### Parameters

##### action

[`ProblemRecoveryAction`](/api/frontend-react/src/type-aliases/problemrecoveryaction/)

##### problem

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

#### Returns

`ReactNode`

---

### titleLevel?

> `readonly` `optional` **titleLevel?**: `2` \| `3` \| `4` \| `5` \| `6`
