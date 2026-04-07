---
editUrl: false
next: false
prev: false
title: "Scope"
---

> **Scope** = `"singleton"` \| `"request"` \| `"transient"`

Defined in: [packages/framework-context/src/libs/types.ts:1](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/types.ts#L1)

컴포넌트 인스턴스 생명주기를 정의하는 scope 타입입니다.

## Example

```typescript
import type { Scope } from '@croco/framework-context';

const scope: Scope = 'singleton';
```
