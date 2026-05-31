---
editUrl: false
next: false
prev: false
title: "ProblemCategoryMapper"
---

> `const` **ProblemCategoryMapper**: `object`

ProblemCategory를 HTTP 상태 코드와 제목으로 매핑하는 유틸리티입니다.

## Type Declaration

### toHttpStatus()

> **toHttpStatus**: (`category`) => `number`

#### Parameters

##### category

[`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

#### Returns

`number`

### toTitle()

> **toTitle**: (`category`) => `string`

#### Parameters

##### category

[`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

#### Returns

`string`
