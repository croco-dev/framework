---
editUrl: false
next: false
prev: false
title: "ProblemFactory"
---

> `const` **ProblemFactory**: `object`

Defined in: [packages/problems-core/src/libs/ProblemFactory.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/ProblemFactory.ts#L11)

카테고리별 기본 Problem 인스턴스를 생성하는 팩토리입니다.

## Type Declaration

### badRequest()

> **badRequest**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### businessRuleViolation()

> **businessRuleViolation**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### conflict()

> **conflict**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### forbidden()

> **forbidden**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### gone()

> **gone**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### internalServerError()

> **internalServerError**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### notFound()

> **notFound**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### notImplemented()

> **notImplemented**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### tooManyRequests()

> **tooManyRequests**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### unauthorized()

> **unauthorized**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

### validationError()

> **validationError**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

#### Parameters

##### code

`string`

##### detail?

`string`

##### options?

[`ProblemOptions`](/api/problems-core/src/interfaces/problemoptions/)

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

## Example

```typescript
import { ProblemFactory } from '@croco/problems-core';

const problem = ProblemFactory.notFound('user/not-found', '사용자를 찾을 수 없습니다.');
const body = problem.toJSON();
```
