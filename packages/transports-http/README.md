# @croco/transports-http

Hono 기반 고성능 HTTP 전송 레이어. AWS Lambda와 API Gateway v2에 최적화된 실행 엔진을 제공합니다.

## 주요 기능

- **요청 크기 제한**: Content-Length 기반 본문 크기 제한 (기본 1MB)
- **응답 압축**: gzip, brotli, deflate 지원
- **Graceful Shutdown**: SIGTERM/SIGINT 시그널 처리 및 활성 요청 완료 대기
- **Rate Limiting**: @croco/ratelimit-core 통합
- **CORS/보안 헤더**: 설정 가능한 CORS 및 보안 헤더 미들웨어
- **Lambda 최적화**: API Gateway v2 이벤트 어댑터 제공

## 설치

```bash
pnpm add @croco/transports-http
```

## 기본 사용법

```typescript
import { createApp, Controller, Get, corsMiddleware, securityHeadersMiddleware } from '@croco/transports-http';

@Controller('/api')
class UserController {
  @Get('/users')
  listUsers() {
    return [{ id: 1, name: 'John' }];
  }
}

const app = createApp({
  controllers: [UserController],
  middlewares: [
    corsMiddleware({ origins: ['https://example.com'] }),
    securityHeadersMiddleware(),
  ],
});

export const handler = app.lambdaHandler();
```

## 미들웨어

### Body Limit

```typescript
import { bodyLimitMiddleware, mb } from '@croco/transports-http';

app.use(bodyLimitMiddleware({ limit: mb(5) })); // 5MB 제한
```

### Compression

```typescript
import { compressionMiddleware } from '@croco/transports-http';

app.use(compressionMiddleware({
  threshold: 1024,
  encodings: ['br', 'gzip'],
}));
```

### Graceful Shutdown

```typescript
import { gracefulShutdownMiddleware, setupGracefulShutdown } from '@croco/transports-http';

const shutdown = setupGracefulShutdown({
  timeoutMs: 30000,
  onShutdown: async () => {
    await db.disconnect();
  },
});

app.use(gracefulShutdownMiddleware());

process.on('SIGTERM', shutdown);
```

### Rate Limiting

```typescript
import { rateLimitHttpMiddleware, RateLimiter, SlidingWindowInMemoryStore } from '@croco/transports-http';
import { createSlidingWindowPolicy } from '@croco/ratelimit-core';

const store = new SlidingWindowInMemoryStore();
const rateLimiter = new RateLimiter(store);

app.use(rateLimitHttpMiddleware({
  rateLimiter,
  policy: createSlidingWindowPolicy({ name: 'api', limit: 100, windowMs: 60000 }),
}));
```

### CORS

```typescript
import { corsMiddleware } from '@croco/transports-http';

app.use(corsMiddleware({
  origins: ['https://app.example.com'],
  methods: ['GET', 'POST'],
  credentials: true,
  maxAge: 86400,
}));
```

### Security Headers

```typescript
import { securityHeadersMiddleware } from '@croco/transports-http';

app.use(securityHeadersMiddleware({
  contentTypeOptions: true,
  strictTransportSecurity: { maxAge: 31536000 },
  frameOptions: 'DENY',
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  contentSecurityPolicy: "default-src 'self'",
}));
```

## Lambda 통합

```typescript
import { createApp, getLambdaEvent, getLambdaContext } from '@croco/transports-http';
import { Controller, Get, Raw } from '@croco/protocols-rest';

@Controller('/')
class LambdaController {
  @Get('/metadata')
  getMetadata(@Raw() raw: { req: { raw: { env: { event: LambdaEvent; lambdaContext: LambdaContext } } } }) {
    const event = raw.req.raw.env.event;
    const context = raw.req.raw.env.lambdaContext;

    return {
      requestId: context.awsRequestId,
      stage: event.requestContext.stage,
    };
  }
}

const app = createApp({ controllers: [LambdaController] });
export const handler = app.lambdaHandler();
```

## 타입 안전성

모든 미들웨어는 Hono의 타입 시스템과 통합되어 타입 안전성을 보장합니다.

```typescript
import type { MiddlewareFunction, CrocoHttpContext } from '@croco/transports-http';

const customMiddleware: MiddlewareFunction = async (ctx, next) => {
  // ctx는 CrocoHttpContext 타입으로 타입 안전
  const userAgent = ctx.header('user-agent');
  await next();
};
```

## 벤치마크

패키지에 포함된 벤치마크를 실행하여 Lambda 콜드스타트 성능을 측정할 수 있습니다.

```bash
pnpm test src/tests/CrocoApp.bench.ts
```

## 라이선스

MIT
