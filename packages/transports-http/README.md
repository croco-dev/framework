# @croco/transports-http

Croco의 HTTP 실행 계층입니다. `@croco/protocols-rest`로 정의한 컨트롤러를 Hono 기반 앱, Node 서버, AWS Lambda 핸들러로 연결합니다.
HTTP 실패 응답은 Croco [Failure Semantics](../../packages/docs/src/content/docs/en/guides/failure-semantics.mdx)를 기준으로 `Problem`은 RFC 7807 응답으로 보존하고, generic `Error`는 unhandled internal fault로 취급합니다.

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

### 요청 관측성과 Problem 메타데이터

등록된 컨트롤러 요청은 기본 HTTP server span 안에서 실행됩니다. 요청 중 `Problem` 또는 일반 에러가
발생하면 span에는 HTTP status와 Croco Problem code/category가 기록되고, Problem Details 응답에는
추적에 사용할 안전한 correlation metadata가 포함됩니다. `traceId`는 요청 trace가 있을 때 포함되고,
`requestId`는 runtime request id가 있을 때 포함됩니다. Node runtime의 `requestId`는 요청의
`x-request-id` 헤더를 우선 사용하고 없으면 transport가 생성한 id를 사용합니다. Lambda runtime의
`requestId`는 API Gateway `event.requestContext.requestId`를 우선 사용하고 없으면 Lambda
`awsRequestId`를 사용합니다.

Telemetry 설정 자체가 실패하면 요청은 degraded mode로 계속 처리되지만 `X-Croco-Telemetry-Degraded`
응답 헤더와 Problem Details의 `telemetry: { degraded: true, reason: "telemetry_setup_failed" }`
메타데이터로 실패 증거를 남깁니다. 응답에는 안정적인 degradation reason만 직렬화하고 setup exception
message, stack, raw header/body, secret 값은 포함하지 않습니다.

### RuntimeContext

컨트롤러, guard, interceptor, service에서는 `@croco/framework-context`의
`Context.getRuntimeContext()`로 Node/Lambda 요청의 공통 런타임 정보를 읽을 수 있습니다.

```typescript
import { Context } from "@croco/framework-context";

const runtime = Context.getRuntimeContext();

runtime?.waitUntil(Promise.resolve());

console.log(runtime?.platform); // "node" 또는 "lambda"
console.log(runtime?.requestId);
```

| Runtime | `env`         | `requestId`                                | `waitUntil` | `flush`                                 |
| ------- | ------------- | ------------------------------------------ | ----------- | --------------------------------------- |
| Node    | `process.env` | `x-request-id` 또는 generated id           | no-op       | no-op                                   |
| Lambda  | `process.env` | API Gateway request id 또는 `awsRequestId` | queued work | queued work drain, rejected work logged |

### Lambda API Gateway v2 요청 매핑

Lambda handler는 API Gateway v2 이벤트를 Fetch `Request`로 변환합니다.

| Event field                         | Fetch request behavior                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `requestContext.http.method`        | Fetch request method. 값이 없으면 `GET`을 사용합니다.                                      |
| `rawPath`, `rawQueryString`         | `https://lambda.local${rawPath}?${rawQueryString}` 형태의 request URL을 구성합니다.        |
| `headers`                           | Fetch `Headers`로 복사되며 Fetch 표준에 따라 대소문자 구분 없이 조회할 수 있습니다.        |
| `headers.cookie` / `headers.Cookie` | 명시된 `Cookie` header가 있으면 그대로 유지하며 `event.cookies`보다 우선합니다.            |
| `cookies`                           | 명시된 `Cookie` header가 없을 때 `; `로 join해 inbound Fetch `Cookie` header로 설정합니다. |
| `body`, `isBase64Encoded`           | base64 body는 `Buffer`로 디코딩하고, `GET`/`HEAD` 요청에는 body를 전달하지 않습니다.       |

원본 Lambda `event`와 `context`는 Hono env에 그대로 보존되며 `getLambdaEvent()`와
`getLambdaContext()`로 읽을 수 있습니다.

Lambda에서 OpenTelemetry span export까지 보장하려면 `@croco/telemetry-sdk-node`의
`TelemetryRuntime.forceFlush()`를 handler flush callback으로 연결합니다. 이 callback이 실패하면 Lambda
handler도 실패하므로 관측 실패가 성공 응답으로 숨겨지지 않습니다.

```typescript
import { TelemetryRuntime, lambdaPreset } from "@croco/telemetry-sdk-node";

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({ serviceName: "orders" }));

export const handler = app.lambdaHandler({
  flush: async () => {
    const result = await telemetry.forceFlush(5000);
    if (!result.success) {
      throw result.error ?? new Error("telemetry flush failed");
    }
  },
});
```

### Lambda 응답 헤더와 쿠키 매핑

`app.lambdaHandler()`는 API Gateway HTTP API payload format v2 응답을 반환합니다. 일반 Fetch 응답
헤더는 `LambdaResponse.headers`의 single-value header record로 매핑합니다. `Set-Cookie` 응답 헤더는
single-value record에 넣지 않고 API Gateway v2 전용 `LambdaResponse.cookies: string[]`로 매핑합니다.
API Gateway는 `cookies` 배열의 각 값을 개별 `set-cookie` 응답 헤더로 변환하므로, auth/session 응답에서
여러 쿠키나 `Expires=Wed, 21 Oct ...`처럼 comma가 포함된 쿠키 값을 안전하게 보존할 수 있습니다.

JSON 응답은 문자열 body와 `isBase64Encoded: false`를 유지하고, binary 응답은 기존처럼 body를 base64로
인코딩한 뒤 `isBase64Encoded: true`를 반환합니다.

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

## Operational Endpoints

`createApp()`는 별도 컨트롤러 없이 운영 endpoint를 등록합니다. Readiness 실행은
`@croco/health-core`의 `HealthCheckService`를 통해 수행되며, `HealthCheckRegistry`는 HTTP에서
간단히 이름별 체크를 등록하기 위한 adapter입니다.

| Endpoint                  | 기본 노출 | 성공 응답                               | 실패 응답                       |
| ------------------------- | --------- | --------------------------------------- | ------------------------------- |
| `GET /health`             | on        | `200 { "status": "ok" }`                | 없음                            |
| `GET /health/live`        | on        | `200 { "status": "ok" }`                | 없음                            |
| `GET /ready`              | on        | `200 { "status": "up", "results": [] }` | `503 { "status": "down", ... }` |
| `GET /health/ready`       | on        | `/ready`와 동일                         | `/ready`와 동일                 |
| `GET /health/diagnostics` | off       | `200 DiagnosticsReport`                 | `403 { "error": "Forbidden" }`  |

`/ready`와 `/health/ready`는 `@croco/health-core`의 `HealthCheckResult` readiness contract를
그대로 반환합니다. 등록된 체크가 없으면 `{ "status": "up", "results": [] }`로 간주합니다. 체크
함수가 실패하거나 timeout을 넘기면 해당 체크는 `results` 배열에서
`{ "name": "...", "status": "down", "details": { "error": "..." } }`로 직렬화되고 전체 응답은
`503`입니다.

### Diagnostics exposure policy

Diagnostics는 기본적으로 꺼져 있습니다. 앱 코드에서 명시하거나 기존 환경변수 경로를 사용할 수
있습니다.

```typescript
const app = createApp({
  controllers: [UserController],
  diagnostics: {
    exposure: "token",
    token: process.env.CROCO_DIAGNOSTICS_TOKEN,
  },
});
```

지원되는 exposure mode:

| Mode      | 동작                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| `off`     | `/health/diagnostics`를 등록하지 않습니다. 기본값입니다.                         |
| `private` | token 없이 노출합니다. Private network, local smoke, internal LB에만 사용합니다. |
| `token`   | `X-Diagnostics-Token` 헤더가 configured token과 같을 때만 허용합니다.            |
| `custom`  | `guard` 함수가 true를 반환할 때만 허용합니다.                                    |

하위 호환을 위해 `CROCO_DIAGNOSTICS_ENABLED=true`도 지원합니다. 이때
`CROCO_DIAGNOSTICS_TOKEN`이 있으면 `token`, 없으면 `private`로 동작합니다. 새 설정에서는
`diagnostics.exposure` 사용을 권장합니다.

Diagnostics 응답은 `Cache-Control: no-store`를 포함합니다. `recentErrors`는 기본 최대 100개까지
최신순으로 반환되며 `cause`/stack trace는 노출하지 않습니다. 오류 메시지와 provider message는 기본
100자로 제한되고, `token`, `secret`, `password`, `authorization`, `cookie`, `credential`,
`apiKey` 계열 detail key는 `[Redacted]`로 대체됩니다. 필요하면 `recentErrorLimit`과
`messageLimit`을 조정할 수 있습니다.

## Failure response contract

`ErrorHandler`는 Croco `Problem`을 만나면 `type`, `title`, `status`, `code`, `detail`, `instance`와
안전한 extension을 직렬화합니다. RFC 7807 표준 필드는 Problem extension으로 덮어쓸 수 없고,
transport가 만든 `traceId`, `requestId`, `telemetry` correlation metadata는 redaction 이후에도
복구와 로그 검색에 사용할 수 있도록 응답에 남습니다. 일반 `Error`는 로그에 남기고
`500 Internal Server Error`의 opaque 응답으로 변환합니다. 따라서 컨트롤러, guard, interceptor,
provider adapter는 사용자가 복구할 수 있는 실패를 transport까지 generic `Error`로 넘기지 말고
package-specific `Problem`으로 정규화해야 합니다.

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

`rateLimitHttpMiddleware`의 `skipSuccessfulRequests`와 `skipFailedRequests`는 응답 상태가 결정된 뒤 성공한 limiter 체크의 refund receipt를 사용해 해당 outcome이 quota를 소비하지 않게 합니다. `skip` predicate는 기존처럼 limiter 체크 자체를 실행하지 않습니다.

기존 앱을 단계적으로 마이그레이션해야 한다면 명시적으로 opt-out 할 수 있습니다.

```typescript
const app = createApp({
  controllers: [UserController],
  middlewares: [securityHeadersMiddleware()],
  securityValidation: "off",
});
```

기존 `unsafeSkipSecurityValidation: true` 플래그도 하위 호환용으로 지원되지만, 새 설정에는 `securityValidation: 'off'` 사용을 권장합니다.

DI graph도 HTTP bootstrap에서 같은 정책으로 검증됩니다. production 기본값은 `enforce`,
development/test 기본값은 `warn`이며, `Container.validate({ force: true })`를 실행하고
컨트롤러, guard, interceptor, filter, pipe constructor가 Croco DI에 등록되어 있는지 route
registration 전에 확인합니다.

```typescript
const app = createApp({
  controllers: [UserController],
  diValidation: "enforce",
});
```

마이그레이션 중 아직 컨트롤러나 provider를 명시적으로 등록하지 않았다면 `warn` 또는 `off`를
선택할 수 있습니다. `warn`은 동일한 diagnostic을 logger warning으로 남긴 뒤 legacy
`new type()` fallback을 허용하고, `off` 또는 `unsafeSkipDiValidation: true`는 검증과
fallback 차단을 모두 끕니다. 운영 경로에서는 `enforce`를 권장합니다.

### Required middleware

| Middleware                  | Export                   | Purpose                                                                        |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `securityHeadersMiddleware` | `@croco/transports-http` | Sets HTTP security headers: HSTS, X-Frame-Options, X-Content-Type-Options, CSP |
| `corsMiddleware`            | `@croco/transports-http` | Configures Cross-Origin Resource Sharing policy                                |
| `bodyLimitMiddleware`       | `@croco/transports-http` | Caps request body size to prevent payload-based DoS                            |
| `rateLimitHttpMiddleware`   | `@croco/transports-http` | Applies rate limiting to HTTP requests                                         |

All four are part of the public API and can be imported directly from `@croco/transports-http`.
Generated applications should register all four by default. Missing middleware fails bootstrap with
`CROCO_HTTP_SECURITY_001` and `legacyCode: "transports-http/security-middleware-validation"`.
Consumers that matched the previous slash-form code should migrate to `CROCO_HTTP_SECURITY_001`;
the legacy value is preserved in `extensions.legacyCode` for compatibility during that migration.

Use `securityValidation: 'off'` or `CROCO_HTTP_SECURITY_VALIDATION=off` only for explicit local
migration/testing fixtures where the unsafe path is the behavior under test. Do not depend on the
opt-out for normal first-run or production bootstrap.

## API 레퍼런스

- 앱 런타임: `createApp`, `CrocoApp`, `ErrorHandler`, `PipelineRunner`, `RouteCompiler`
- Lambda 연동: `toLambdaHandler`, `getLambdaEvent`, `getLambdaContext`, `TypedLambdaHandler`
- 헬스체크: `HealthCheckRegistry`, `HealthCheckFunction`, `HealthCheckResult`
- 운영 endpoint: `DiagnosticsEndpointOptions`, `DiagnosticsExposureMode`, `DIAGNOSTICS_ENDPOINT_PATH`
- 본문 제한: `bodyLimitMiddleware`, `kb`, `mb`
- 압축: `compressionMiddleware`
- CORS: `corsMiddleware`
- 종료 제어: `createGracefulShutdownController`, `gracefulShutdownMiddleware`, `setupGracefulShutdown`, `isShuttingDown`,
  `resetShutdownState`
- 레이트 리밋: `rateLimitHttpMiddleware`, `createRateLimitMiddlewareFactory`
- 보안 헤더: `securityHeadersMiddleware`
- 타입: `AppConfig`, `CrocoHttpContext`, `CrocoRequest`, `CrocoResponse`, `LambdaEvent`, `LambdaResponse`
