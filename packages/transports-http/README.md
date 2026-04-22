# @croco/transports-http

Croco의 HTTP 실행 계층입니다. `@croco/protocols-rest`로 정의한 컨트롤러를 Hono 기반 앱, Node 서버, AWS Lambda 핸들러로 연결합니다.

## 설치

```bash
pnpm add @croco/transports-http @croco/protocols-rest reflect-metadata
```

## 사용법

### 앱 생성과 Lambda 핸들러 노출

```typescript
import 'reflect-metadata';
import { Controller, Get } from '@croco/protocols-rest';
import { createApp, corsMiddleware, securityHeadersMiddleware } from '@croco/transports-http';

@Controller('/users')
class UserController {
  @Get('/')
  list() {
    return [{ id: 'user-1' }];
  }
}

const app = createApp({
  controllers: [UserController],
  middlewares: [corsMiddleware(), securityHeadersMiddleware()],
});

export const handler = app.lambdaHandler();
```

### Node 서버 실행

```typescript
await app.listen(3000);
```

### 헬스체크 등록

```typescript
import { Container } from '@croco/framework-context';
import { HealthCheckRegistry } from '@croco/transports-http';

Container.get(HealthCheckRegistry).register('database', async () => ({ status: 'up' }));
```

## Security Middleware Contract

> **Currently unenforced repo-wide.** This section defines the recommended security middleware that HTTP bootstraps should apply. Enforcement is left to each application.

When calling `createApp`, include the following middleware in the `middlewares` array:

```typescript
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from '@croco/transports-http';

const app = createApp({
  controllers: [UserController],
  middlewares: [
    securityHeadersMiddleware(),       // HSTS, X-Frame-Options, CSP, etc.
    corsMiddleware({ origin: ['https://example.com'] }), // Cross-Origin policy
    bodyLimitMiddleware({ maxSize: mb(1) }),              // Request body size cap
    rateLimitHttpMiddleware({ limit: 100, window: 60 }), // Rate limiting
  ],
});
```

### Required middleware

| Middleware | Export | Purpose |
|---|---|---|
| `securityHeadersMiddleware` | `@croco/transports-http` | Sets HTTP security headers: HSTS, X-Frame-Options, X-Content-Type-Options, CSP |
| `corsMiddleware` | `@croco/transports-http` | Configures Cross-Origin Resource Sharing policy |
| `bodyLimitMiddleware` | `@croco/transports-http` | Caps request body size to prevent payload-based DoS |
| `rateLimitHttpMiddleware` | `@croco/transports-http` | Applies rate limiting to HTTP requests |

All four are part of the public API and can be imported directly from `@croco/transports-http`.

## API 레퍼런스

- 앱 런타임: `createApp`, `CrocoApp`, `ErrorHandler`, `PipelineRunner`, `RouteCompiler`
- Lambda 연동: `toLambdaHandler`, `getLambdaEvent`, `getLambdaContext`, `TypedLambdaHandler`
- 헬스체크: `HealthCheckRegistry`, `HealthCheckFunction`, `HealthCheckResult`
- 본문 제한: `bodyLimitMiddleware`, `kb`, `mb`
- 압축: `compressionMiddleware`
- CORS: `corsMiddleware`
- 종료 제어: `gracefulShutdownMiddleware`, `setupGracefulShutdown`, `isShuttingDown`, `resetShutdownState`
- 레이트 리밋: `rateLimitHttpMiddleware`, `createRateLimitMiddlewareFactory`
- 보안 헤더: `securityHeadersMiddleware`
- 타입: `AppConfig`, `CrocoHttpContext`, `CrocoRequest`, `CrocoResponse`, `LambdaEvent`, `LambdaResponse`
