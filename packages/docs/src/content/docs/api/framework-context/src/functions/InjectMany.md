---
editUrl: false
next: false
prev: false
title: "InjectMany"
---

같은 식별자로 등록된 모든 서비스를 클래스 프로퍼티 또는 생성자 파라미터에 주입하는 TypeDI 데코레이터입니다.

## Param

**token**

선택적 다중 주입 식별자입니다. 생략하면 타입 메타데이터를 사용합니다.

## Call Signature

> **InjectMany**(): `Function`

### Returns

`Function`

## Call Signature

> **InjectMany**(`typeFn`): `Function`

### Parameters

#### typeFn

(`type?`) => [`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`unknown`\>

### Returns

`Function`

## Call Signature

> **InjectMany**(`serviceName?`): `Function`

### Parameters

#### serviceName?

`string`

### Returns

`Function`

## Call Signature

> **InjectMany**(`token`): `Function`

### Parameters

#### token

[`Token`](/api/framework-context/src/classes/token/)\<`unknown`\>

### Returns

`Function`
