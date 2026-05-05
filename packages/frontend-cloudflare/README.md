# @croco/frontend-cloudflare
> Croco Presentation Tier — 5th layer: Framework → Protocols → Transports → Integrations → Presentation

Cloudflare Workers 환경에서 SSR 핸들러를 제공하는 패키지입니다.

이 패키지는 Cloudflare Workers 환경에서 Vike 기반 SSR을 수행하기 위한 핸들러를 제공합니다.

## 설치

```bash
pnpm add @croco/frontend-cloudflare
```

## 사용법

### Worker 핸들러 생성

`worker.ts`에서 SSR 핸들러를 생성합니다:

```typescript
import { createSsrHandler } from '@croco/frontend-cloudflare';

export default {
  fetch: createSsrHandler(),
};
```

### Service Binding 설정

`wrangler.toml`에서 Service Binding을 설정합니다:

```toml
[env.production]
services = [
  { binding = "API_WORKER", service = "api-worker" },
  { binding = "ASSETS", service = "assets-worker" },
]
```

## API

### `createSsrHandler(options?)`

SSR 핸들러를 생성합니다.

**옵션:**
- `apiBindingName?: string` - API 서비스 Worker의 바인딩 이름 (기본값: `'API_WORKER'`)

**반환값:** `(request: Request, env: SsrWorkerEnv, ctx: ExecutionContext) => Promise<Response>`

## 동작

핸들러는 다음 순서로 요청을 처리합니다:

1. 정적 자산 요청 (`env.ASSETS`)
2. API 요청 (`/api/*` 경로, `env.API_WORKER`)
3. 페이지 렌더링 (Vike SSR)

## 타입

### `SsrWorkerEnv`

Cloudflare Worker 환경 타입입니다.

```typescript
export type SsrWorkerEnv = {
  API_WORKER?: Fetcher;
  ASSETS?: Fetcher;
};
```

### `SsrHandlerOptions`

SSR 핸들러 옵션 타입입니다.

```typescript
export type SsrHandlerOptions = {
  apiBindingName?: string;
};
```

## 예제

### 기본 설정

```typescript
import { createSsrHandler } from '@croco/frontend-cloudflare';

export default {
  fetch: createSsrHandler(),
};
```

### 커스텀 API 바인딩 이름

```typescript
import { createSsrHandler } from '@croco/frontend-cloudflare';

export default {
  fetch: createSsrHandler({ apiBindingName: 'MY_API' }),
};
```

## 라이선스

MIT