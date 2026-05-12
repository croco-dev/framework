# @croco/transports-http

Croco의 HTTP 실행 계층입니다. `@croco/protocols-rest`로 정의한 컨트롤러를 Hono 기반 앱, Node 서버, AWS Lambda 핸들러로 연결합니다.

## 설치

```bash
pnpm add @croco/transports-http @croco/protocols-rest reflect-metadata
```

## 사용법

### 앱 생성과 Lambda 핸들러 노출

```typescript
import "reflect-metadata";
import {
  createSlidingWindowPolicy,
  RateLimitKeyBuilder,
  RateLimiter,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { Controller, Get } from "@croco/protocols-rest";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";

@Controller("/users")
class UserController {
  @Get("/")
  list() {
    return [{ id: "user-1" }];
  }
}

const rateLimiter = new RateLimiter(
  new SlidingWindowInMemoryStore(),
  new RateLimitKeyBuilder(["ip"]),
);

const app = createApp({
  controllers: [UserController],
  middlewares: [
    securityHeadersMiddleware(),
    corsMiddleware({ origins: ["https://example.com"] }),
    bodyLimitMiddleware({ limit: mb(1) }),
    rateLimitHttpMiddleware({
      rateLimiter,
      policy: createSlidingWindowPolicy("http", 100, 60_000),
    }),
  ],
});

export const handler = app.lambdaHandler();
```

### Node 서버 실행

```typescript
await app.listen(3000);
```

### 헬스체크 등록

```typescript
import { Container } from "@croco/framework-context";
import { HealthCheckRegistry } from "@croco/transports-http";

Container.get(HealthCheckRegistry).register("database", async () => ({ status: "up" }));
```

## Security Middleware Contract

`createApp`는 기본적으로 아래 4개 보안 미들웨어가 모두 등록되어 있는지 부트스트랩 시점에 검증합니다. 하나라도 누락되면 앱 생성은 fail-closed로 중단됩니다.

When calling `createApp`, include the following middleware in the `middlewares` array:

```typescript
import {
  createSlidingWindowPolicy,
  RateLimitKeyBuilder,
  RateLimiter,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  mb,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "@croco/transports-http";

const rateLimiter = new RateLimiter(
  new SlidingWindowInMemoryStore(),
  new RateLimitKeyBuilder(["ip"]),
);

const app = createApp({
  controllers: [UserController],
  middlewares: [
    securityHeadersMiddleware(), // HSTS, X-Frame-Options, CSP, etc.
    corsMiddleware({ origins: ["https://example.com"] }), // Cross-Origin policy
    bodyLimitMiddleware({ limit: mb(1) }), // Request body size cap
    rateLimitHttpMiddleware({
      rateLimiter,
      policy: createSlidingWindowPolicy("http", 100, 60_000),
    }), // Rate limiting
  ],
});
```

기존 앱을 단계적으로 마이그레이션해야 한다면 명시적으로 opt-out 할 수 있습니다.

```typescript
const app = createApp({
  controllers: [UserController],
  middlewares: [securityHeadersMiddleware()],
  securityValidation: "off",
});
```

기존 `unsafeSkipSecurityValidation: true` 플래그도 하위 호환용으로 지원되지만, 새 설정에는 `securityValidation: 'off'` 사용을 권장합니다.

### Required middleware

| Middleware                  | Export                   | Purpose                                                                        |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `securityHeadersMiddleware` | `@croco/transports-http` | Sets HTTP security headers: HSTS, X-Frame-Options, X-Content-Type-Options, CSP |
| `corsMiddleware`            | `@croco/transports-http` | Configures Cross-Origin Resource Sharing policy                                |
| `bodyLimitMiddleware`       | `@croco/transports-http` | Caps request body size to prevent payload-based DoS                            |
| `rateLimitHttpMiddleware`   | `@croco/transports-http` | Applies rate limiting to HTTP requests                                         |

All four are part of the public API and can be imported directly from `@croco/transports-http`. Unless `securityValidation: 'off'` is set, missing any of them will cause bootstrap validation to fail.

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
