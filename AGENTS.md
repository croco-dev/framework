# AGENTS.md

AI 코딩 에이전트용 프로젝트 가이드 - TypeScript 모노레포

## Commands

```bash
# Build
pnpm build              # 전체 패키지 빌드
pnpm build --filter=@croco/framework-context  # 단일 패키지 빌드

# Test
pnpm test               # 전체 테스트
pnpm test --filter=@croco/retry-core  # 단일 패키지 테스트
cd packages/retry-core && pnpm vitest run src/tests/Retryable.spec.ts  # 단일 테스트 파일
cd packages/retry-core && pnpm vitest run -t "should retry"  # 테스트 이름으로 실행

# Lint & Format
pnpm check              # Biome 검사
pnpm check --write      # Biome 자동 수정
biome check --write packages/retry-core  # 단일 패키지

# Type Check
pnpm typecheck          # 전체 패키지
pnpm typecheck --filter=@croco/events-core  # 단일 패키지
```

## Code Style

Biome 설정 기준:
- Indent: 2 spaces
- Line width: 120 characters
- Quote style: single quotes
- Trailing commas: ES5 style
- Type imports 필수 (`import type { X }` 사용)
- 미사용 imports/variables 금지 (error)
- `any` 명시적 사용 금지 (warning)
- Non-null assertion 금지 (error)

## Import Order

Biome 자동 정렬 순서:
1. 외부 패키지 (reflect-metadata, typedi 등)
2. 내부 @croco/* 패키지
3. 상대 경로 (./libs/*, ../types)
4. Type imports 별도 분리

## Naming Conventions

- Classes: PascalCase (RetryTemplate, CircuitBreaker)
- Interfaces: PascalCase, "I" 접두사 금지 (RetryPolicy, 아닌 IRetryPolicy)
- Types: PascalCase (BackoffOptions, ComponentMetadata)
- Constants: SCREAMING_SNAKE_CASE (REST_CONTROLLER_KEY)
- Functions/methods: camelCase
- Files: 클래스는 PascalCase (Component.ts), 유틸리티는 camelCase
- Test files: `src/tests/[ClassName].spec.ts` (필수 규칙)

## Decorator Pattern

```typescript
export function Retryable(options: RetryableOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    // ... 래핑 로직
    return descriptor;
  };
}

export function Component(options?: ComponentOptions): ClassDecorator {
  return (target: object) => {
    Container.register(target, options?.scope ?? 'singleton');
  };
}
```

## Error Handling

RFC 7807 Problem 기반:
```typescript
export class NotFoundProblem extends Problem {
  readonly code = 'NOT_FOUND';
  readonly category = ProblemCategory.NOT_FOUND;

  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
  }
}

// Problem 하위클래스만 throw, 일반 Error 금지
throw new NotFoundProblem('User', userId);
```

## Test Patterns (Vitest)

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ClassName', () => {
  let instance!: ClassName;  // definite assignment

  beforeEach(() => {
    Container.reset();  // 항상 DI 컨테이너 리셋
    instance = new ClassName();
  });

  it('should do something', async () => {
    const result = await instance.method();
    expect(result).toBe(expected);
  });

  it('should handle errors', async () => {
    await expect(instance.failingMethod()).rejects.toThrow(SomeError);
  });
});
```

## Type Patterns

```typescript
// 객체 형태는 type 우선
export type BackoffOptions = {
  delay?: number;
  maxDelay?: number;
  multiplier?: number;
};

// 계약/구현은 interface
export interface RetryPolicy {
  shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean;
}

// 제네릭 제약조건
export type Constructor<T = unknown> = new (...args: unknown[]) => T;
```

## Barrel Exports (index.ts)

```typescript
// 카테고리별 그룹화, types 마지막
export { Container, Context } from './libs/Container';
export { Component } from './libs/decorators/Component';
export type { ComponentMetadata, Scope, Token } from './libs/types';
```

## Package Structure

```
packages/[name]/
├── src/
│   ├── index.ts          # Barrel exports
│   ├── libs/             # 구현
│   │   ├── ClassName.ts
│   │   └── decorators/   # 데코레이터가 있을 경우
│   └── tests/            # 테스트 파일 (*.spec.ts)
├── package.json
└── tsconfig.json
```

## Git Hooks (Lefthook)

- pre-commit: `biome check --write` (자동 포맷)
- pre-push: `pnpm test && pnpm typecheck`
- post-merge: `pnpm install`

이 저장소의 기본 브랜치는 main이 아니라 trunk다. 브랜치 관련 예시와 기준은 trunk를 기준으로 해석한다.

## Telemetry & Tracing

Croco는 OpenTelemetry 표준을 기반으로 한 분산 추적(Distributed Tracing)을 제공합니다.

### 패키지 구조

```
@croco/telemetry-api      # 애플리케이션에서 사용하는 API (@Trace, withSpan)
@croco/telemetry-sdk-node  # SDK 초기화 및 설정 (OpenTelemetry SDK 래핑)
```

### API vs SDK 분리

- **telemetry-api**: 애플리케이션 코드에서 사용
  - `@Trace` 데코레이터: 메서드 자동 추적
  - `withSpan`: 함수 실행 감싸기
  - `recordError`, `recordEvent`: Span에 이벤트/에러 기록
  - `getActiveTraceInfo`: 현재 Trace 컨텍스트 정보

- **telemetry-sdk-node**: 애플리케이션 시작 시 초기화
  - `TelemetryRuntime.init()`: OpenTelemetry SDK 초기화
  - `lambdaPreset`: Lambda 환경 최적화 설정
  - `ProbabilitySampler`: 샘플링 비율 제어

### 사용 패턴

```typescript
// 1. 애플리케이션 시작 시 SDK 초기화 (전역 스코프)
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'my-service',
  probability: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
}));

// 2. 서비스 클래스에서 @Trace 데코레이터 사용
import { Trace } from '@croco/telemetry-api';

@Service()
class OrderService {
  @Trace({ name: 'order.create' })
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // 자동으로 추적됨
    return this.repository.save(dto);
  }
}

// 3. Lambda 핸들러에서 forceFlush (데이터 전송 보장)
export const handler = async (event: any) => {
  try {
    return await processEvent(event);
  } finally {
    await telemetry.forceFlush();
  }
};
```

### Lambda 환경 주의사항

**⚠️ `AWS_LAMBDA_EXEC_WRAPPER`를 사용하지 마세요**

OpenTelemetry 공식 문서와 달리, Croco에서는 Exec Wrapper 방식을 사용하지 않습니다. 대신 다음 방식을 사용하세요:

1. 핸들러 파일 상단에서 전역 스코프로 `TelemetryRuntime.init()` 호출
2. 핸들러 반환 전에 `forceFlush()` 호출

이유:
- Layer 의존성 제거
- 콜드 스타트 최적화
- 초기화 타이밍 직접 제어

### OTLP 전용

Croco는 **OTLP(OpenTelemetry Protocol)만 지원**합니다. X-Ray와 통합하려면 ADOT Collector를 사이드카로 실행해야 합니다:

```yaml
# collector.yaml (ADOT Collector)
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  awsxray:
    region: ap-northeast-2

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [awsxray]
```

### 샘플링 전략

| 환경 | 확률 | 설명 |
|------|------|------|
| development | 1.0 (100%) | 모든 요청 추적 |
| staging | 0.5 ~ 1.0 | 50~100% 추적 |
| production | 0.01 ~ 0.1 | 1~10% 추적 (비용 절감) |

## Architecture Notes

- 5-계층: Framework → Protocols → Transports → Integrations → Presentation
- **Presentation** (신규): frontend-react/frontend-vite/frontend-cloudflare + 신규 codegen 패키지(rpc-codegen, openapi-spec). 사용자 코드(apps/console-web)와 직접 닿는 어댑터 계층.
- DI: typedi + 커스텀 Container 래퍼
- AsyncLocalStorage: request-scoped context
- 이벤트 기반 아키텍처 (events-core + events-inmemory)
- 분산 추적: OpenTelemetry OTLP 기반 (@croco/telemetry-api + @croco/telemetry-sdk-node)


## Dependency Rules

### repository-core

`@croco/repository-core`는 **인터페이스 레이어**다. 아래 의존성을 가져서는 안 된다:

- `drizzle-orm` — ORM 라이브러리 직접 참조 금지
- `@croco/tx-drizzle` — Drizzle 구현체 참조 금지
- `@croco/tx-core`의 Drizzle 관련 타입 직접 사용 금지

Drizzle 기반 구현체(`AbstractDrizzleRepository` 등)는 반드시 `@croco/tx-drizzle` 패키지에 위치해야 한다.

위반 체크: `grep -r "drizzle" packages/repository-core/src/`가 결과를 출력하면 의존성 오염이다.