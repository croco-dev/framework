---
editUrl: false
next: false
prev: false
title: "ComponentOptions"
---

Defined in: [packages/framework-context/src/libs/types.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L5)

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

Defined in: [packages/framework-context/src/libs/types.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L6)

컴포넌트 생명주기 범위입니다.
