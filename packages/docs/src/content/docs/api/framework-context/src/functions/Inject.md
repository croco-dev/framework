---
editUrl: false
next: false
prev: false
title: "Inject"
---

클래스 프로퍼티 또는 생성자 파라미터에 의존성을 주입하는 TypeDI 데코레이터입니다.

## Param

선택적 주입 식별자입니다. 생략하면 타입 메타데이터를 사용합니다.

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

Injects a service into a class property or constructor parameter.

### Returns

`Function`

## Call Signature

> **Inject**(`typeFn`): `Function`

Injects a service into a class property or constructor parameter.

### Parameters

#### typeFn

(`type?`) => `Constructable`\<`unknown`\>

### Returns

`Function`

## Call Signature

> **Inject**(`serviceName?`): `Function`

Injects a service into a class property or constructor parameter.

### Parameters

#### serviceName?

`string`

### Returns

`Function`

## Call Signature

> **Inject**(`token`): `Function`

Injects a service into a class property or constructor parameter.

### Parameters

#### token

[`Token`](/api/framework-context/src/classes/token/)\<`unknown`\>

### Returns

`Function`
