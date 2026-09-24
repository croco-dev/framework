---
editUrl: false
next: false
prev: false
title: "InjectMany"
---

DI compiler가 같은 식별자의 모든 provider를 주입하도록 표시하는 데코레이터입니다.

## Param

**token**

선택적 다중 주입 식별자입니다. 생략하면 DI compiler가 선언 타입 symbol을 해석합니다.

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

`symbol` \| [`Token`](/api/framework-context/src/classes/token/)\<`unknown`\>

### Returns

`Function`
