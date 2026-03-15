---
editUrl: false
next: false
prev: false
title: "ProblemCategoryMapper"
---

> `const` **ProblemCategoryMapper**: `object`

Defined in: [packages/problems-core/src/libs/ProblemCategoryMapper.ts:31](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/problems-core/src/libs/ProblemCategoryMapper.ts#L31)

ProblemCategory를 HTTP 응답용 status/title로 변환하는 매퍼입니다.

## Type Declaration

### toHttpStatus()

> **toHttpStatus**(`category`): `number`

#### Parameters

##### category

[`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

#### Returns

`number`

### toTitle()

> **toTitle**(`category`): `string`

#### Parameters

##### category

[`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

#### Returns

`string`

## Example

```typescript
import { ProblemCategory, ProblemCategoryMapper } from '@croco/problems-core';

const status = ProblemCategoryMapper.toHttpStatus(ProblemCategory.NotFound);
const title = ProblemCategoryMapper.toTitle(ProblemCategory.NotFound);
```
