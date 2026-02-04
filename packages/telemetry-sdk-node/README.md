# @croco/telemetry-sdk-node

Croco 프레임워크를 위한 OpenTelemetry SDK입니다.

이 패키지는 **OpenTelemetry SDK를 초기화하고 구성**합니다. AWS Lambda 환경에 최적화된 설정预设(Preset)을 제공하며, OTLP(OpenTelemetry Protocol)를 통해 AWS X-Ray로 추적 데이터를 전송합니다.

## 설치

```bash
pnpm add @croco/telemetry-sdk-node
pnpm add @opentelemetry/api @opentelemetry/resources @opentelemetry/sdk-node @opentelemetry/sdk-trace-base @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-http
```

## 개요

### 초기화 흐름

```
애플리케이션 시작
    ↓
TelemetryRuntime.init(config)
    ↓
OpenTelemetry SDK 초기화
    ↓
OTLP Trace Exporter 설정
    ↓
추적 데이터 수집 시작
```

### 중요: Lambda 환경 주의사항

**⚠️ `AWS_LAMBDA_EXEC_WRAPPER` 환경변수를 사용하지 마세요**

OpenTelemetry 공식 문서에서는 `AWS_LAMBDA_EXEC_WRAPPER`를 사용하라고 권장하지만, **Croco에서는 이 방식을 사용하지 않습니다**. 이유는 다음과 같습니다:

1. **Layer 의존성**: Exec Wrapper 방식은 별도의 Lambda Layer가 필요합니다
2. **콜드 스타트**: Wrapper 로드로 인한 추가 콜드 스타트 시간
3. **제어권 상실**: 초기화 타이밍을 직접 제어할 수 없습니다

대신 **Croco 방식**을 사용하세요:

```typescript
// lambda.ts
import { TelemetryRuntime } from '@croco/telemetry-sdk-node';
import { lambdaPreset } from '@croco/telemetry-sdk-node';

// 1. 핸들러 외부에서 초기화 (전역 스코프)
const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'my-service',
}));

// 2. 핸들러 정의
export const handler = async (event: APIGatewayEvent) => {
  // 요청 처리
};

// 3. (선택사항) context.freezeCallback으로 flush 타이밍 제어
export const handler = async (event: any) => {
  const result = await processEvent(event);

  // Lambda가 응답을 반환하기 전에 추적 데이터를 flush
  await telemetry.forceFlush();

  return result;
};
```

## 사용법

### 1. 기본 초기화

```typescript
import { TelemetryRuntime } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',

  trace: {
    enabled: true,
    exporterUrl: 'http://localhost:4318/v1/traces',
    batchTimeout: 5000,
    batchCount: 2048,
    batchSize: 512,
  },

  metrics: {
    enabled: false,
  },

  logs: {
    enabled: false,
  },
});
```

### 2. Lambda Preset 사용 (권장)

Lambda 환경에서는 `lambdaPreset`을 사용하는 것을 권장합니다.

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'order-service',
  serviceVersion: '1.0.0',
  probability: 0.1, // 프로덕션: 10% 샘플링
}));
```

#### Lambda Preset 옵션

```typescript
interface LambdaPresetOptions {
  serviceName: string;           // 필수
  serviceVersion?: string;        // 선택
  probability?: number;           // 샘플링 확률 (기본값: 개발 1.0, 프로덕션 0.1)
  exporterUrl?: string;           // OTLP Exporter URL
  exporterHeaders?: Record<string, string>; // 추가 HTTP 헤더
}
```

#### Lambda Preset 기본 설정

```typescript
{
  serviceName: options.serviceName,
  serviceVersion: options.serviceVersion,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.TELEMETRY_ENABLED !== 'false',

  resourceAttributes: {
    'cloud.provider': 'aws',
    'cloud.platform': 'aws_lambda',
    'deployment.environment': environment,
  },

  trace: {
    enabled: true,
    exporterUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    exporterHeaders: { 'X-Croco-Source': 'lambda' },
    sampler: new ProbabilitySampler({ probability }),
    batchTimeout: 3000,  // Lambda에 최적화
    batchCount: 512,
    batchSize: 256,
  },

  metrics: { enabled: false },
  logs: { enabled: false },
}
```

### 3. 환경변수로 설정

```bash
# .env 또는 Lambda 환경변수
TELEMETRY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://adot-collector:4318/v1/traces
NODE_ENV=production
```

### 4. forceFlush 사용

Lambda 환경에서는 핸들러 반환 전에 `forceFlush()`를 호출하여 추적 데이터가 전송되도록 해야 합니다.

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({ serviceName: 'my-service' }));

export const handler = async (event: any) => {
  try {
    const result = await processEvent(event);
    return result;
  } finally {
    // Lambda가 응답을 반환하기 전에 추적 데이터 flush
    await telemetry.forceFlush();
  }
};
```

### 5. 샘플링 설정

`ProbabilitySampler`를 사용하여 샘플링 비율을 제어합니다.

```typescript
import { ProbabilitySampler } from '@croco/telemetry-sdk-node';

await telemetry.init({
  serviceName: 'my-service',
  trace: {
    sampler: new ProbabilitySampler({
      probability: 0.1, // 10%만 추적
    }),
  },
});
```

#### 샘플링 확률 가이드

| 환경 | 권장 확률 | 설명 |
|------|-----------|------|
| 개발 (development) | `1.0` (100%) | 모든 요청 추적 |
| 스테이징 (staging) | `0.5` ~ `1.0` | 50~100% 추적 |
| 프로덕션 (production) | `0.01` ~ `0.1` | 1~10% 추적 (비용 절감) |

## 전체 설정 타입

```typescript
interface TelemetryConfig {
  serviceName: string;           // 필수: 서비스 이름
  serviceVersion?: string;        // 선택: 서비스 버전
  environment?: string;           // 선택: 환경 (development/production)
  enabled?: boolean;              // 선택: 전체 활성화 (기본값: true)
  resourceAttributes?: Record<string, string | number | boolean>; // 선택: 리소스 속성

  trace?: TraceConfig;
  metrics?: MetricsConfig;
  logs?: LogsConfig;
}

interface TraceConfig {
  enabled?: boolean;              // 선택: 추적 활성화 (기본값: true)
  exporterUrl?: string;           // 선택: OTLP Exporter URL
  exporterHeaders?: Record<string, string>; // 선택: HTTP 헤더
  sampler?: Sampler;              // 선택: 샘플러
  batchTimeout?: number;          // 선택: 배치 타임아웃 (ms)
  batchCount?: number;            // 선택: 최대 배치 큐 크기
  batchSize?: number;             // 선택: 최대 배치 크기
  instrumentations?: Array<never>; // 선택: 자동 계측 (현재 미사용)
}

interface MetricsConfig {
  enabled?: boolean;
  exporterUrl?: string;
  exporterHeaders?: Record<string, string>;
  exportIntervalMillis?: number;
  exportTimeoutMillis?: number;
}

interface LogsConfig {
  enabled?: boolean;
}
```

## Lambda 핸들러 예시

### REST API (API Gateway)

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';
import { createHttpHandler } from '@croco/transports-http';
import { Controller, Get } from '@croco/protocols-rest';

// 전역 스코프에서 초기화
const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'user-api',
  probability: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
}));

@Controller('/users')
class UserController {
  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return { id, name: 'Croco' };
  }
}

// 핸들러 생성
const baseHandler = createHttpHandler({
  controllers: [UserController],
});

// forceFlush 래퍼
export const handler = async (event: any, context: any) => {
  try {
    return await baseHandler(event, context);
  } finally {
    await telemetry.forceFlush();
  }
};
```

### SQS 트리거

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'order-processor',
}));

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    await processMessage(record.body);
  }

  await telemetry.forceFlush();
};
```

## OTLP Exporter

이 SDK는 **OTLP over HTTP**를 사용하여 추적 데이터를 전송합니다. AWS X-Ray와 통합하려면 **ADOT Collector**를 사이드카로 실행해야 합니다.

### Exporter URL 설정

```typescript
// 기본값 (로컬 개발)
exporterUrl: 'http://localhost:4318/v1/traces'

// Docker Compose 환경
exporterUrl: 'http://adot-collector:4318/v1/traces'

// AWS ECS (사이드카)
exporterUrl: 'http://localhost:4318/v1/traces'

// 로컬 테스트용 ADOT Collector
exporterUrl: 'http://adot-collector:4318/v1/traces'
```

## 관련 패키지

- **[@croco/telemetry-api](../telemetry-api/)**: 애플리케이션에서 사용하는 API (`@Trace`, `withSpan`)
- **OpenTelemetry 문서**: https://opentelemetry.io/docs/instrumentation/node/

## 라이선스

MIT License. Copyright (c) 2026 Croco Team.
