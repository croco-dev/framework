# @croco/frontend-react

> Croco Presentation Tier — 5th layer: Framework → Protocols → Transports → Integrations → Presentation

React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지입니다.

이 패키지는 React 앱에서 Vike와 함께 Croco의 SSR 데이터 전송 기능을 사용하기 위한 훅과 설정 함수를 제공합니다.

## 설치

```bash
pnpm add @croco/frontend-react
```

## 사용법

### 페이지 설정

각 페이지의 `+config.ts`에서 기본 설정을 사용합니다:

```typescript
// pages/index/+config.ts
import { createCrocoPageConfig } from "@croco/frontend-react";

export default createCrocoPageConfig({ ssr: true });
```

### 데이터 전송

페이지 데이터를 전송하려면 `+data.ts`에서 함수를 정의합니다:

```typescript
// pages/index/+data.ts
import { type CrocoDataFn } from "@croco/frontend-react";

export const data: CrocoDataFn<{ message: string }> = async () => {
  return {
    message: "Hello from SSR!",
  };
};
```

### React에서 데이터 사용

`usePageData` 훅으로 타입 안전하게 데이터에 접근합니다:

```typescript
// pages/index/+Page.tsx
import { usePageData } from '@croco/frontend-react';

export default function Page() {
  const data = usePageData<{ message: string }>();

  return <div>{data.message}</div>;
}
```

## API

### `createCrocoPageConfig(options?)`

Vike 페이지 설정의 기본값을 제공합니다.

**옵션:**

- `ssr?: boolean` - SSR 활성화 여부 (기본값: `true`)

**반환값:**

```typescript
{
  ssr: boolean;
  passToClient: readonly[("data", "title", "description")];
}
```

### `usePageData<T>()`

Vike의 `usePageContext`를 래핑하여 데이터에 타입 안전 접근을 제공합니다.

**제네릭:**

- `T` - 페이지 데이터 타입 (기본값: `unknown`)

**반환값:** `T`

## 타입

### `CrocoPageContext`

페이지 컨텍스트 타입입니다.

```typescript
export type CrocoPageContext = {
  urlOriginal: string;
  data?: unknown;
  title?: string;
  description?: string;
  env?: Record<string, unknown>;
};
```

### `CrocoDataFn<T>`

페이지 데이터 전송 함수 타입입니다.

```typescript
export type CrocoDataFn<T = unknown> = (pageContext: CrocoPageContext) => Promise<T> | T;
```

## 라이선스

MIT
