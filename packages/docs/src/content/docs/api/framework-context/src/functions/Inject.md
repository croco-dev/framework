---
editUrl: false
next: false
prev: false
title: "Inject"
---

컴파일러가 클래스 프로퍼티 또는 생성자 파라미터의 의존성 연결을 생성하도록 표시하는 데코레이터입니다.

## Param

**token**

선택적 주입 식별자입니다. 생략하면 DI compiler가 선언 타입 symbol을 해석합니다.

## Example

```typescript
import { Inject } from "@croco/framework-context";

class Repository {}

class UserService {
  @Inject()
  private readonly repository!: Repository;
}
```

## Call Signature

> **Inject**(): `Function`

### Returns

`Function`

## Call Signature

> **Inject**(`typeFn`): `Function`

### Parameters

#### typeFn

(`type?`) => [`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`unknown`\>

### Returns

`Function`

## Call Signature

> **Inject**(`serviceName?`): `Function`

### Parameters

#### serviceName?

`string`

### Returns

`Function`

## Call Signature

> **Inject**(`token`): `Function`

### Parameters

#### token

`symbol` \| [`Token`](/api/framework-context/src/classes/token/)\<`unknown`\>

### Returns

`Function`
