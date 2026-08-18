---
editUrl: false
next: false
prev: false
title: "Scope"
---

> **Scope** = `"singleton"` \| `"request"` \| `"transient"`

컴포넌트 인스턴스 생명주기를 정의하는 scope 타입입니다.

## Example

```typescript
import type { Scope } from "@croco/framework-context";

const scope: Scope = "singleton";
```
