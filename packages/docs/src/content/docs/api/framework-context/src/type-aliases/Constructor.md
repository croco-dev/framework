---
editUrl: false
next: false
prev: false
title: "Constructor"
---

> **Constructor**\<`T`\> = (...`args`) => `T`

인스턴스를 생성할 수 있는 생성자 시그니처 타입입니다.

## Type Parameters

### T

`T` = `unknown`

## Parameters

### args

...`never`[]

## Returns

`T`

## Example

```typescript
import type { Constructor } from "@croco/framework-context";

class UserService {}

const target: Constructor<UserService> = UserService;
```
