---
editUrl: false
next: false
prev: false
title: "ProblemSerializer"
---

> `const` **ProblemSerializer**: `object`

Defined in: [packages/problems-core/src/libs/ProblemSerializer.ts:15](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemSerializer.ts#L15)

## Type Declaration

### deserialize()

> **deserialize**(`serialized`): [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

SerializedProblem을 ProblemDetails로 변환합니다.

#### Parameters

##### serialized

`SerializedProblem`

역직렬화할 SerializedProblem

#### Returns

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

ProblemDetails

### fromJson()

> **fromJson**(`json`): [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

JSON 객체를 ProblemDetails로 파싱합니다.
필수 필드(type, title, status, code)와 선택적 필드를 검증합니다.

#### Parameters

##### json

`unknown`

파싱할 JSON 객체

#### Returns

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

ProblemDetails

#### Throws

필수 필드가 없거나 타입이 잘못된 경우

### serialize()

> **serialize**(`problem`): `SerializedProblem`

ProblemDetails를 SerializedProblem으로 변환합니다.
확장 필드는 별도의 extensions 속성으로 분리됩니다.

#### Parameters

##### problem

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

직렬화할 ProblemDetails

#### Returns

`SerializedProblem`

SerializedProblem
