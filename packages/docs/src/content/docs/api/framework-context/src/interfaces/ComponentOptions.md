---
editUrl: false
next: false
prev: false
title: "ComponentOptions"
---

`@Component` 데코레이터에 전달하는 컴포넌트 옵션 타입입니다.

## Example

```typescript
import type { ComponentOptions } from '@croco/framework-context';

const options: ComponentOptions = {
  scope: 'request',
};
```

## Properties

### scope?

> `optional` **scope**: [`Scope`](/api/framework-context/src/type-aliases/scope/)

컴포넌트 생명주기 범위입니다.
