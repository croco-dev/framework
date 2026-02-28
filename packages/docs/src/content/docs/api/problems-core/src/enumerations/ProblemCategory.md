---
editUrl: false
next: false
prev: false
title: "ProblemCategory"
---

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:1](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L1)

Problem의 도메인 분류와 HTTP 의미론을 연결하는 카테고리 열거형입니다.

## Example

```typescript
import { ProblemCategory } from '@croco/problems-core';

const category = ProblemCategory.ValidationError;
```

## Enumeration Members

### BadRequest

> **BadRequest**: `"BadRequest"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:2](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L2)

잘못된 요청 형식 또는 파라미터 문제를 나타냅니다.

***

### BusinessRuleViolation

> **BusinessRuleViolation**: `"BusinessRuleViolation"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L9)

***

### Conflict

> **Conflict**: `"Conflict"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:6](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L6)

***

### Forbidden

> **Forbidden**: `"Forbidden"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L4)

***

### Gone

> **Gone**: `"Gone"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L7)

***

### InternalServerError

> **InternalServerError**: `"InternalServerError"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:11](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L11)

***

### NotFound

> **NotFound**: `"NotFound"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L5)

요청한 리소스를 찾을 수 없는 상태를 나타냅니다.

***

### NotImplemented

> **NotImplemented**: `"NotImplemented"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L12)

***

### TooManyRequests

> **TooManyRequests**: `"TooManyRequests"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L10)

***

### Unauthorized

> **Unauthorized**: `"Unauthorized"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:3](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L3)

***

### ValidationError

> **ValidationError**: `"ValidationError"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/problems-core/src/libs/ProblemCategory.ts#L8)

입력 검증 실패를 나타냅니다.
