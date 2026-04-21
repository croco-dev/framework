---
editUrl: false
next: false
prev: false
title: "ComponentMetadata"
---

Defined in: [packages/framework-context/src/libs/types.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L9)

컴포넌트 등록 시 내부적으로 사용하는 메타데이터 타입입니다.

## Example

```typescript
import type { ComponentMetadata } from '@croco/framework-context';

const metadata: ComponentMetadata = {
  scope: 'singleton',
  target: class Service {},
};
```

## Properties

### scope

> **scope**: [`Scope`](/api/framework-context/src/type-aliases/scope/)

Defined in: [packages/framework-context/src/libs/types.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L10)

컴포넌트 생명주기 범위입니다.

***

### target

> **target**: [`Constructor`](/api/framework-context/src/type-aliases/constructor/)

Defined in: [packages/framework-context/src/libs/types.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L11)

등록 대상 생성자입니다.
