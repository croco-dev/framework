---
editUrl: false
next: false
prev: false
title: "ProblemCategoryMapper"
---

> `const` **ProblemCategoryMapper**: `object`

Defined in: [packages/problems-core/src/libs/ProblemCategoryMapper.ts:81](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/problems-core/src/libs/ProblemCategoryMapper.ts#L81)

ProblemCategory와 HTTP 상태 코드 및 제목 간의 매핑을 제공합니다.
RFC 7807 Problem Details 형식과 호환됩니다.

## Type Declaration

### toHttpStatus()

> **toHttpStatus**: (`category`) => `number`

ProblemCategory를 HTTP 상태 코드로 변환합니다.

#### Parameters

##### category

[`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

변환할 ProblemCategory

#### Returns

`number`

해당 카테고리에 해당하는 HTTP 상태 코드

#### Throws

처리되지 않은 카테고리인 경우

### toTitle()

> **toTitle**: (`category`) => `string`

ProblemCategory를 사람이 읽을 수 있는 제목으로 변환합니다.

#### Parameters

##### category

[`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

변환할 ProblemCategory

#### Returns

`string`

해당 카테고리의 제목 문자열

#### Throws

처리되지 않은 카테고리인 경우
