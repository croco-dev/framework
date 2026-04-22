- framework-context의 TypeDI 브릿지는 `symbol`을 내부 `TypeDIToken`으로 매핑하면 `as any` 없이 기존 API를 유지할 수 있다.
- `Constructor<T = unknown>`는 `new (...args: never[]) => T`로 두면 `Constructor<any>`를 제거하면서 생성자 인자 타입과의 호환성을 유지할 수 있다.
- optional dependency는 TypeDI 런타임 에러 이름(`ServiceNotFoundError`, `CannotInstantiateValueError`) 기반으로 안전하게 `undefined` 처리할 수 있다.
- request scope는 AsyncLocalStorage 경계를 넘어도 동일 인스턴스를 유지하는 테스트로 회귀를 막을 수 있다.

## Phase 1 교차 의존성 검증 결과 (2025-04-05)

### Build Results
- Status: PARTIAL FAILURE
- Issue: @croco/llm-core 패키지에서 타입 에러 발생
- Error: src/libs/LlmService.ts(109,4) - Method decorator signature resolution error
- Note: Pre-existing error (T55에서 수정 예정)

### Typecheck Results
- Status: PARTIAL FAILURE
- Issue: @croco/llm-core 패키지에서 타입 에러 2개
- Error: TS1241, TS1270 - Decorator function return type mismatch
- Note: Pre-existing error (T55에서 수정 예정)

### Test Results
- Status: PARTIAL FAILURE
- Total: 73 successful, 74 total
- Failed: @croco/tx-drizzle#test
- Failed Test: src/tests/RealDb.spec.ts > RealDb > should commit transaction
- Note: Phase 1 변경사항과 관련된 실패일 수 있음 (tx-core, tx-drizzle 수정 영향)

### Check Results (Biome)
- Status: SUCCESS (with warnings)
- Warnings: 12개
- Issues:
  - noExplicitAny: 10개 (auth-core, events-core, framework-config, protocols-rest)
  - unused suppressions: 2개 (framework-logger)
- All warnings are pre-existing, not related to Phase 1 changes

### Evidence Files
- .sisyphus/evidence/build-20260405-194637.log
- .sisyphus/evidence/typecheck-20260405-194716.log
- .sisyphus/evidence/test-20260405-194826.log
- .sisyphus/evidence/check-20260405-194915.log

### Summary
Phase 1 변경사항(framework-context, tx-core, tx-drizzle)은 Biome 검사에서 문제 없음.
llm-core의 pre-existing 타입 에러는 T55에서 처리 예정.
tx-drizzle 테스트 실패는 Phase 1 변경과 관련 있을 수 있어 추가 조사 필요.
- cache-core는 `Map`의 delete 후 set 재삽입으로 true LRU를 단순하게 구현할 수 있고, `getOrSet()`에 in-flight Promise 맵을 두면 singleflight stampede protection을 외부 의존성 없이 제공할 수 있다.


## Phase 2 - protocols-rest Zod 타입 안전성 작업 완료 (2025-04-06)

### 작업 내용
- `packages/protocols-rest` 패키지에 Zod 기반 타입 안전성 및 스키마 검증 기능 추가

### 생성된 파일
1. `src/libs/schemas/ValidationSchema.ts` - Request/Response DTO 스키마 타입 정의
2. `src/libs/types/RouteTypes.ts` - 타입 안전한 라우트 핸들러 제네릭 타입
3. `src/libs/types/index.ts` - 타입 exports
4. `src/libs/validators/ValidationProblem.ts` - Problem 기반 검증 에러 클래스
5. `src/libs/validators/SchemaValidator.ts` - 스키마 검증 헬퍼 함수
6. `src/libs/validators/ValidationPipe.ts` - PipeTransform 기반 검증 파이프

### 추가된 의존성
- `zod: ^3.23.8` - 런타임 타입 검증 라이브러리

### 주요 기능
- `RequestSchema`, `ResponseSchema`, `RouteSchema` 타입 - 스키마 정의 계약
- `TypedRouteConfig`, `TypedRouteHandler` - 제네릭 기반 타입 안전 라우트
- `ValidationProblem` - RFC 7807 기반 검증 에러 (422 상태 코드)
- `RequestValidationProblem`, `ResponseValidationProblem` - 세분화된 에러 클래스
- `validateRequest()`, `validateResponse()` - 스키마 검증 유틸리티
- `createValidator()` - 재사용 가능한 검증기 팩토리
- `ValidationPipe` - PipeTransform 인터페이스 구현체

### 사용 예시
```typescript
import { z } from "zod";
import { ValidationPipe, createValidator } from "@croco/protocols-rest";
import { Body, UsePipes } from "@croco/protocols-rest";

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

@Controller("/users")
class UserController {
  @Post("/")
  @UsePipes(new ValidationPipe(UserSchema))
  async create(@Body() body: z.infer<typeof UserSchema>) {
    return body;
  }
}
```

### 빌드 결과
- Status: SUCCESS
- package.json에 zod 의존성 추가 완료
- index.ts에 새로운 exports 추가 완료
- 모든 기존 테스트 통과 (110 tests)



## Phase 2 - protocols-graphql 타입 안전성 및 Guard/Interceptor 통합 완료 (2025-04-06)

### 작업 내용
- `packages/protocols-graphql` 패키지에 타입 안전성 및 Guard/Interceptor 통합 기능 추가

### 생성된 파일
1. `src/libs/types/GuardTypes.ts` - GraphQL Guard 타입 정의 (GraphQLGuard, GraphQLGuardContext)
2. `src/libs/types/InterceptorTypes.ts` - GraphQL Interceptor 타입 정의 (GraphQLInterceptor, GraphQLInterceptorContext, GraphQLCallHandler)
3. `src/libs/types/ResolverTypes.ts` - 타입 안전 Resolver 타입 (TypedResolver, ResolverFactory, GuardedResolver)
4. `src/libs/types/index.ts` - 타입 exports
5. `src/libs/guards/GuardChain.ts` - Guard 체인 실행 클래스
6. `src/libs/guards/AuthGuard.ts` - GraphQL 인증 Guard (JWT 토큰 검증)
7. `src/libs/guards/RolesGuard.ts` - GraphQL 역할 기반 Guard
8. `src/libs/guards/index.ts` - Guard exports
9. `src/libs/interceptors/InterceptorChain.ts` - Interceptor 체인 실행 클래스
10. `src/libs/interceptors/LoggingInterceptor.ts` - 로깅 인터셉터
11. `src/libs/interceptors/GuardInterceptor.ts` - Guard를 Interceptor로 래핑
12. `src/libs/interceptors/index.ts` - Interceptor exports
13. `src/libs/errors/GraphQLProblems.ts` - GraphQL 전용 Problem 클래스들
14. `src/libs/errors/ErrorConverter.ts` - Problem을 GraphQL Error로 변환
15. `src/libs/errors/index.ts` - 에러 관련 exports
16. `src/tests/GuardChain.spec.ts` - Guard 테스트
17. `src/tests/InterceptorChain.spec.ts` - Interceptor 테스트
18. `src/tests/GraphQLProblems.spec.ts` - 에러 처리 테스트

### 추가된 의존성
- `@croco/problems-core: workspace:*` - Problem 기반 에러 처리

### 주요 기능
- `GraphQLGuard` 인터페이스 - framework-context의 Guard를 GraphQL 컨텍스트에 적용
- `GraphQLInterceptor` 인터페이스 - Resolver 레벨 인터셉터 지원
- `GuardChain` - 다중 Guard 순차 실행
- `InterceptorChain` - 다중 Interceptor onion 패턴 실행
- `GraphQLAuthGuard` - JWT 토큰 기반 인증 Guard
- `GraphQLRolesGuard` - 역할 기반 접근 제어 Guard
- `LoggingInterceptor` - Resolver 실행 시간 로깅
- `GuardInterceptor` - Guard를 Interceptor로 통합
- `TypedResolver<TSource, TContext, TArgs, TReturn>` - 제네릭 기반 타입 안전 Resolver
- `problemToGraphQLError()` - Problem을 GraphQL Error로 변환
- `GraphQLValidationProblem`, `GraphQLAuthorizationProblem` 등 - GraphQL 전용 에러 클래스

### 메타데이터 키 추가
- `GRAPHQL_ROLES_KEY` - 역할 기반 접근 제어 메타데이터
- `GRAPHQL_GUARDS_KEY` - Guard 메타데이터
- `GRAPHQL_INTERCEPTORS_KEY` - Interceptor 메타데이터

### 빌드 결과
- Status: SUCCESS
- package.json에 @croco/problems-core 의존성 추가 완료
- index.ts에 새로운 exports 추가 완료
- 모든 테스트 통과 (33 tests)

### 타입 안전성 주의사항
- ResolverData<TContext>는 TContext가 object 타입을 만족해야 함
- TypedResolver의 TContext 제약조건: `extends Record<string, unknown>`
- type-graphql의 ResolverData 제네릭 제약조건을 준수해야 함

## billing-core T38 작업 메모 (2026-04-06)

- billing-core의 Money 값객체는 amount를 minor unit safe integer로 고정하면 다중 통화 포매팅과 비교 연산을 단순하게 유지할 수 있다.
- 즉시 구독 취소 시 주문 이력이 없으면 subscription/account를 함께 삭제하고, 주문 이력이 있으면 canceled 상태만 남겨 고아 계정과 히스토리 보존을 동시에 만족시킬 수 있다.

## access-drizzle T49 Phase 4 타입 에러 수정 (2026-04-07)

### 문제
- Drizzle DB에서 반환된 `string` 타입을 template literal 타입(`${string}:${string}`, `user:${string}` | `role:${string}` | `group:${string}`)으로 변환할 때 TypeScript 에러 발생

### 해결책
- Type guard 함수 추가로 런타임 검증과 타입 narrowing 동시에 처리
  - `isResourceObject(value: string): value is ResourceObject` - `pattern:[value]` 형식 검증
  - `isSubject(value: string): value is Subject` - `(user|role|group):[value]` 형식 검증
- `assertRelationTupleRow` 함수를 type guard로 강화하여 반환 타입에 template literal 타입 포함

### 패턴
```typescript
function isResourceObject(value: string): value is `${string}:${string}` {
  return /^[^:]+:[^:]+$/.test(value);
}

function isSubject(value: string): value is `user:${string}` | `role:${string}` | `group:${string}` {
  return /^(user|role|group):[^:]+$/.test(value);
}

function assertRelationTupleRow(row: unknown): row is RelationTupleRow & { 
  object: `${string}:${string}`; 
  subject: `user:${string}` | `role:${string}` | `group:${string}` 
} {
  // 런타임 검증 후 type guard 사용
  return isResourceObject(record.object as string) && isSubject(record.subject as string);
}

// 사용 시 자동으로 타입 narrowing 됨
if (assertRelationTupleRow(row)) {
  tuples.push({
    object: row.object, // `${string}:${string}` 타입
    subject: row.subject, // `user:${string}` | `role:${string}` | `group:${string}` 타입
  });
}
```

## SaaS 문서화 작업 메모 (2026-04-09)

- SaaS 비즈니스 로직 패키지 README는 설치, 짧은 사용 예시, 공개 API 목록, 구현 포인트 4섹션으로 맞추면 150줄 이하 제약 안에서 일관성을 유지하기 쉽다.
- 공개 API JSDoc은 내부 구현 파일 전체보다 `src/index.ts`의 re-export 문장에 한국어 설명을 붙이는 방식이 monorepo 선언 파일 문서화에 가장 효율적이다.

### 검증
- TypeScript typecheck 통과
- `as any` 없이 타입 안전성 유지
# Health Check Readiness/Liveness Separation

## Implementation Pattern

### K8s Probe 호환 설계
- **Liveness**: `isLive()` - 프로세스 생존만 확인 (항상 true 반환)
- **Readiness**: `isReady()` - 의존성 상태 확인 (ReadinessIndicator 체크)

### API 구조
```typescript
// 인터페이스 분리
interface ReadinessIndicator extends HealthIndicator {
  isReady(signal?: AbortSignal): Promise<HealthIndicatorResult>;
}

// 등록 메서드 분리
service.register(healthIndicator);        // 일반 헬스체크
service.registerReadiness(readinessIndicator);  // 레디니스 체크
```

### 엔드포인트 구성
- `/health` - 기존 호환용 (200 OK)
- `/health/live` - Liveness probe (항상 200 OK)
- `/health/ready` - Readiness probe (200/503)
- `/ready` - 기존 호환용 (HealthCheckRegistry 사용)

### 테스트 커버리지
- Liveness: 항상 true 반환 검증
- Readiness: Indicator 없으면 true, 모두 up이면 true, 하나라도 down이면 false
- Timeout: Readiness 체크도 timeout 적용 검증

## K8s 호환성
- 200 OK = healthy
- 503 Service Unavailable = unhealthy
- Liveness는 단순 핑 (복구 불가능한 상태만 감지)
- Readiness는 의존성 확인 (트래픽 받을 준비 상태)

## 사용 예시
```typescript
// DB 연결 상태로 레디니스 체크
class DatabaseReadinessIndicator implements ReadinessIndicator {
  async check() { return { name: 'db', status: 'up' }; }
  async isReady() {
    try {
      await this.db.ping();
      return { name: 'db', status: 'up' };
    } catch {
      return { name: 'db', status: 'down', details: { error: 'Connection failed' } };
    }
  }
}

healthService.registerReadiness(new DatabaseReadinessIndicator());
await healthService.isReady(); // true/false
```


## 설정값 검증 패턴 (2026-04-08)

### 개요
위험한 기본값(Infinity 등)을 안전한 기본값으로 변경하고, 유효하지 않은 설정값을 명확한 에러 메시지와 함께 거부하는 패턴 적용

### 1. 에러 클래스 정의
각 패키지에 도메인별 설정 오류 클래스 추가:

```typescript
export class InvalidRetryConfigurationError extends Error {
  readonly name = 'InvalidRetryConfigurationError';

  constructor(message: string) {
    super(`Invalid retry configuration: ${message}`);
  }
}
```

### 2. 기본값 변경 및 검증

**InMemoryEventBus** (`packages/events-inmemory/src/libs/InMemoryEventBus.ts`)
- 기본값: `Number.POSITIVE_INFINITY` → `100`
- 검증: 양의 유한수 확인

```typescript
const maxConcurrency = options.maxConcurrency ?? 100;
if (!Number.isFinite(maxConcurrency) || maxConcurrency <= 0) {
  throw new InvalidEventBusConfigurationError(
    `maxConcurrency must be a positive finite number, got ${maxConcurrency}`
  );
}
```

**BatchLoader** (`packages/dataloader-core/src/libs/BatchLoader.ts`)
- 기본값: `Infinity` → `50`
- 검증: 양의 유한수 확인

```typescript
const maxBatchSize = options.maxBatchSize ?? 50;
if (!Number.isFinite(maxBatchSize) || maxBatchSize <= 0) {
  throw new InvalidBatchLoaderConfigurationError(
    `maxBatchSize must be a positive finite number, got ${maxBatchSize}`
  );
}
```

**RetryTemplate** (`packages/retry-core/src/libs/RetryTemplate.ts`)
- 검증: 양의 정수 확인 (NaN, 음수 거부)

```typescript
const maxAttempts = options.maxAttempts ?? 3;
if (!Number.isInteger(maxAttempts) || maxAttempts <= 0 || Number.isNaN(maxAttempts)) {
  throw new InvalidRetryConfigurationError(
    `maxAttempts must be a positive integer, got ${maxAttempts}`
  );
}
```

**CircuitBreaker** (`packages/retry-core/src/libs/CircuitBreaker.ts`)
- 검증: failureThreshold (양의 정수), openDuration (양의 유한수)

```typescript
if (!Number.isInteger(failureThreshold) || failureThreshold <= 0) {
  throw new InvalidRetryConfigurationError(
    `failureThreshold must be a positive integer, got ${failureThreshold}`
  );
}
if (!Number.isFinite(openDuration) || openDuration <= 0) {
  throw new InvalidRetryConfigurationError(
    `openDuration must be a positive number, got ${openDuration}`
  );
}
```

### 3. 검증 방법

| 값 타입 | 메서드 | 예시 |
|---------|--------|------|
| 정수 | `Number.isInteger()` | maxAttempts, failureThreshold |
| 유한수 | `Number.isFinite()` | maxConcurrency, openDuration |
| NaN | `Number.isNaN()` | 추가 검증 |

### 4. 결과
- 모든 수정 패키지 타입체크 통과
- 모든 기존 테스트 통과 (29 + 15 + 116 = 160 tests)

## Graceful Shutdown 개선 (2025-04-08)

### 셧다운 순서 개선

이전: 새 요청 거부 → 진행 중 요청 완료 대기 → onShutdown 콜백 → process.exit(0)

개선 후: 새 요청 거부 → 진행 중 요청 완료 대기 → 이벤트 버스 드레인 → 리소스 정리 → 종료

```typescript
// 이벤트 버스 드레인 단계 추가
async function drainEventBus(logger: ILogger, timeoutMs: number): Promise<void> {
  try {
    const { EventBusConfig } = await import('@croco/events-core');
    const config = EventBusConfig.getInstance();
    const eventBus = config.getEventBus();
    
    // 실행 중인 이벤트 핸들러가 모두 완료될 때까지 대기
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const runningCount = eventBus.getRunningHandlerCount?.() ?? 0;
        if (runningCount === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  } catch {
    // events-core가 없으면 무시
  }
}
```

### 주요 변경사항

1. **이벤트 버스 드레인**: InMemoryEventBus의 getRunningHandlerCount()를 사용하여 실행 중인 핸들러가 모두 완료될 때까지 대기
2. **Logger 통합**: 셧다운 시작/완료/타임아웃 로그 추가
3. **process.exit(0) 제거**: 정상적인 이벤트 루프 종료로 변경
4. **Lambda 환경 고려**: Lambda에서는 시그널 핸들러를 등록하지 않음

### 패턴

- 동적 임포트로 optional dependency 처리
- Noop Logger 패턴으로 optional logger 처리
- isLambdaEnvironment 플래그로 환경별 동작 제어

### 테스트 결과

- transports-http 테스트: 78개 통과
- 타입 체크: 통과

## Phase 7 - Input Validation 인프라 (Zod 기반) 완료 (2026-04-08)

### 작업 내용
- `@croco/protocols-rest` 패키지에 Zod 기반 요청 검증 데코레이터 추가
- `@croco/transports-http` 패키지의 ParamResolver에 검증 로직 통합

### 변경된 파일
1. `packages/protocols-rest/src/libs/decorators/Params.ts` - 스키마 파라미터 지원
2. `packages/protocols-rest/src/libs/types.ts` - ParamMetadata.pipes 타입 수정
3. `packages/transports-http/src/libs/ParamResolver.ts` - Zod 스키마 처리 및 ValidationPipe 생성
4. `packages/protocols-rest/src/tests/InputValidation.spec.ts` - 새로운 테스트 파일

### 주요 기능
- `@Body(schema)` - 선택적 Zod 스키마로 요청 본문 검증
- `@Param(name, schema)` - 선택적 Zod 스키마로 경로 파라미터 검증
- `@Query(name, schema)` - 선택적 Zod 스키마로 쿼리 파라미터 검증
- `@Header(name, schema)` - 선택적 Zod 스키마로 헤더 검증
- `RequestValidationProblem` - RFC 7807 기반 400 Bad Request 에러
- `ZodValidationPipe` - transports-http에서 직접 구현한 검증 파이프

### 사용 예시
```typescript
import { z } from 'zod';
import { Controller, Post, Body, Param } from '@croco/protocols-rest';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const IdSchema = z.string().uuid();

@Controller('/users')
class UserController {
  @Post('/:id')
  async update(
    @Param('id', IdSchema) id: string,
    @Body(CreateUserSchema) body: { name: string; email: string }
  ) {
    return { id, ...body };
  }
}
```

### 검증 결과
- protocols-rest: 117 tests passed (7개 신규)
- transports-http: 78 tests passed
- 전체 타입체크 통과

### 백워드 호환성
- 스키마 없이 `@Body()`, `@Param()`, `@Query()`, `@Header()` 사용 가능
- 기존 코드 변경 없이 그대로 동작

## storage-cloudinary 패키지 완전 구현 (2026-04-08)

### 작업 내용
- `packages/storage-cloudinary/` 패키지 완전 구현
- Cloudinary SDK 기반 `CloudinaryProvider` 클래스
- `StorageProvider` 및 `ImageProvider` 인터페이스 구현

### 주요 기능
- 파일 업로드/다운로드/삭제
- 이미지 변환 URL 생성
- 클라이언트 직접 업로드 지원
- 재시도 정책 (transient errors)
- RFC 7807 Problem 기반 에러 처리

### Cloudinary 전용 기능
1. **Global Config Lock**: Cloudinary SDK가 전역 상태를 공유하므로 lock 메커니즘으로 동시성 문제 해결
2. **Context Metadata**: Cloudinary의 `context` 필드를 사용한 사용자 정의 메타데이터
3. **Resource Type Inference**: Content-Type 기반 이미지/동영상/raw 타입 자동 감지
4. **Fit Mode Mapping**: storage-core의 fit 모드를 Cloudinary crop 모드로 매핑
5. **Transient Error Detection**: HTTP status, error code, error message 기반 재시도 가능 여부 판단

### 테스트 커버리지
- 66개 테스트 모두 통과
- 업로드/다운로드/삭제 기능 검증
- 재시도 정책 검증 (transient errors)
- 이미지 변환 URL 생성 검증
- 메타데이터 인코딩/디코딩 검증
- Invalid Key 검증

### 에러 처리
- `UploadFailedProblem`: 업로드 실패
- `FileNotFoundProblem`: 파일 미발견 (404)
- `DeleteFailedProblem`: 삭제 실패
- `InvalidKeyProblem`: 유효하지 않은 키

### 패턴 학습
1. **SDK Lock Pattern**: 전역 상태를 공유하는 SDK는 lock으로 순차 실행 보장
2. **Error Normalization**: 다양한 형태의 에러 객체를 통일된 형태로 정규화
3. **Context Formatting**: key=value 형식으로 메타데이터 인코딩
4. **Retry Policy**: HTTP status, error code, message를 조합한 재시도 판단 로직

## Wave 7 - Core infrastructure 문서화 (2026-04-09)

- core infrastructure 10개 패키지는 README를 150줄 이하의 한국어 요약 문서로 통일하고, 설치/사용법/API 레퍼런스만 남기면 범위 관리가 쉽다.
- 공개 API JSDoc은 barrel export뿐 아니라 실제 공개 선언이 있는 `src/libs/**` 파일까지 확인해야 coverage 누락을 막을 수 있다.
- JSDoc 누락 검사는 `export class|function|const` 패턴을 스크립트로 점검하면 수동 누락을 빠르게 잡을 수 있다.
