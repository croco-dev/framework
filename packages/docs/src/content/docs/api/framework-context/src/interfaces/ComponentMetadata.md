---
editUrl: false
next: false
prev: false
title: "ComponentMetadata"
---

컴포넌트 등록 시 내부적으로 사용하는 메타데이터 타입입니다.

## Example

```typescript
import type { ComponentMetadata } from "@croco/framework-context";

const metadata: ComponentMetadata = {
  scope: "singleton",
  target: class Service {},
};
```

## Properties

### scope

> **scope**: [`Scope`](/api/framework-context/src/type-aliases/scope/)

컴포넌트 생명주기 범위입니다.

---

### target

> **target**: [`Constructor`](/api/framework-context/src/type-aliases/constructor/)

등록 대상 생성자입니다.
