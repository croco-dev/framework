# Croco Telemetry 가이드

이 가이드는 Croco 프레임워크에서 분산 추적(Distributed Tracing)을 설정하고 사용하는 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [빠른 시작](#빠른-시작)
4. [API 사용법](#api-사용법)
5. [AWS X-Ray 통합](#aws-x-ray-통합)
6. [Lambda 예제](#lambda-예제)
7. [모범 사례](#모범-사례)

---

## 개요

Croco Telemetry는 **OpenTelemetry 표준**을 기반으로 한 분산 추적 시스템입니다. 마이크로서비스 아키텍처에서 요청이 여러 서비스를 통과할 때, 전체 흐름을 추적하고 병목 지점을 식별할 수 있습니다.

### 주요 기능

- **자동 추적**: `@Trace` 데코레이터로 메서드 자동 추적
- **수동 추적**: `withSpan` 함수로 함수 실행 감싸기
- **에러 추적**: 자동으로 에러를 Span에 기록
- **이벤트 기록**: 비즈니스 이벤트를 Trace에 포함
- **Lambda 최적화**: AWS Lambda 환경에 최적화된 Preset 제공
- **샘플링**: 확률 기반 샘플링으로 비용 절감

### 지원하는 백엔드

- **AWS X-Ray**: ADOT Collector를 통해 통합
- **Jaeger**: OTLP 직접 전송
- **Tempo**: OTLP 직접 전송
- **기타 OTLP 지원 백엔드**

---

## 아키텍처

### 패키지 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    애플리케이션 코드                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  @croco/telemetry-api                                │  │
│  │  - @Trace 데코레이터                                  │  │
│  │  - withSpan, recordError, recordEvent                │  │
│  │  - getActiveTraceInfo                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  @croco/telemetry-sdk-node                                  │
│  - OpenTelemetry SDK 초기화                                 │
│  - OTLP Trace Exporter                                      │
│  - 샘플러 설정                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ OTLP over HTTP
┌─────────────────────────────────────────────────────────────┐
│  ADOT Collector (또는 다른 OTLP 수신기)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  AWS X-Ray / Jaeger / Tempo                                │
└─────────────────────────────────────────────────────────────┘
```

### API vs SDK

| 패키지 | 역할 | 사용 시점 |
|--------|------|-----------|
| `@croco/telemetry-api` | 애플리케이션에서 추적 API 사용 | 서비스 클래스, 핸들러 |
| `@croco/telemetry-sdk-node` | SDK 초기화 및 설정 | 애플리케이션 시작 시 |

---

## 빠른 시작

### 1. 의존성 설치

```bash
# API 패키지
pnpm add @croco/telemetry-api

# SDK 패키지
pnpm add @croco/telemetry-sdk-node

# OpenTelemetry 의존성
pnpm add @opentelemetry/api @opentelemetry/resources @opentelemetry/sdk-node @opentelemetry/sdk-trace-base @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-http
```

### 2. SDK 초기화

애플리케이션 진입점에서 SDK를 초기화합니다.

```typescript
// src/telemetry.ts
import { TelemetryRuntime } from '@croco/telemetry-sdk-node';
import { lambdaPreset } from '@croco/telemetry-sdk-node';

export const telemetry = TelemetryRuntime.getInstance();

export async function initTelemetry() {
  await telemetry.init(lambdaPreset({
    serviceName: 'my-service',
    probability: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  }));
}
```

### 3. 애플리케이션에서 사용

```typescript
// src/services/OrderService.ts
import { Trace } from '@croco/telemetry-api';
import { Service } from '@croco/framework-context';

@Service()
class OrderService {
  @Trace({ name: 'order.create' })
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // 자동으로 추적됩니다
    return this.repository.save(dto);
  }
}
```

### 4. Lambda 핸들러에서 forceFlush

```typescript
// lambda.ts
import { telemetry } from './src/telemetry';

// 전역 스코프에서 초기화
await telemetry.init(lambdaPreset({
  serviceName: 'order-api',
}));

export const handler = async (event: any) => {
  try {
    return await handleRequest(event);
  } finally {
    // Lambda가 응답을 반환하기 전에 추적 데이터를 flush
    await telemetry.forceFlush();
  }
};
```

---

## API 사용법

### @Trace 데코레이터

메서드에 자동으로 추적을 추가합니다.

```typescript
import { Trace } from '@croco/telemetry-api';

@Service()
class UserService {
  @Trace({ name: 'user.create' })
  async createUser(dto: CreateUserDto): Promise<User> {
    return this.userRepository.save(dto);
  }

  @Trace() // 이름을 지정하지 않으면 메서드 이름 사용
  async deleteUser(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }

  @Trace({
    name: 'user.update',
    attributes: { 'service.type': 'user-management' }
  })
  async updateUser(userId: string, dto: UpdateUserDto): Promise<User> {
    return this.userRepository.update(userId, dto);
  }
}
```

### withSpan 함수

함수 실행을 Span으로 감쌉니다.

```typescript
import { withSpan, recordEvent } from '@croco/telemetry-api';

async function processPayment(orderId: string, amount: number) {
  return await withSpan(async (span) => {
    span.setAttribute('order.id', orderId);
    span.setAttribute('payment.amount', amount);

    // 비즈니스 이벤트 기록
    recordEvent('payment.started', { 'amount': amount });

    const result = await paymentGateway.charge(amount);

    recordEvent('payment.completed', { 'transaction.id': result.id });

    return result;
  }, {
    name: 'payment.process',
    attributes: { 'payment.method': 'credit-card' }
  });
}
```

### recordError 함수

에러를 Span에 기록합니다.

```typescript
import { recordError } from '@croco/telemetry-api';

@Trace()
async processOrder(orderId: string) {
  try {
    await validateOrder(orderId);
  } catch (error) {
    recordError(error); // 현재 Span에 에러 기록
    throw error;
  }
}
```

### recordEvent 함수

비즈니스 이벤트를 기록합니다.

```typescript
import { recordEvent } from '@croco/telemetry-api';

@Trace()
async fulfillOrder(orderId: string) {
  recordEvent('order.packing.started', { 'order.id': orderId });
  await packOrder(orderId);

  recordEvent('order.packing.completed', { 'order.id': orderId });
  recordEvent('order.shipping.started', { 'order.id': orderId });
  await shipOrder(orderId);

  recordEvent('order.shipping.completed', { 'order.id': orderId });
}
```

### getActiveTraceInfo 함수

현재 Trace 컨텍스트 정보를 가져옵니다.

```typescript
import { getActiveTraceInfo } from '@croco/telemetry-api';

@Trace()
async handleRequest() {
  const traceInfo = getActiveTraceInfo();

  // 로그에 Trace ID 포함
  logger.info('Processing request', {
    traceId: traceInfo.traceId,
    spanId: traceInfo.spanId,
  });

  // 다른 서비스로 Trace Context 전파
  await downstreamService.call({
    headers: {
      'traceparent': `00-${traceInfo.traceId}-${traceInfo.spanId}-0${traceInfo.traceFlags ?? 0}`,
    },
  });
}
```

---

## AWS X-Ray 통합

Croco는 **OTLP(OpenTelemetry Protocol)**를 통해 AWS X-Ray로 데이터를 전송합니다. ADOT Collector를 사이드카로 실행해야 합니다.

### 아키텍처

```
Lambda / ECS
    │
    ▼ OTLP over HTTP
ADOT Collector (Sidecar)
    │
    ▼ AWS X-Ray API
AWS X-Ray
```

### ADOT Collector 설정

#### Docker Compose (로컬 개발)

```yaml
# docker-compose.yml
version: '3.8'

services:
  adot-collector:
    image: amazon/aws-otel-collector:latest
    command: --config=/etc/otel-collector-config.yaml
    volumes:
      - ./collector.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4318:4318"  # OTLP HTTP
    environment:
      - AWS_REGION=ap-northeast-2
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
```

```yaml
# collector.yaml
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

#### AWS ECS (사이드카)

```json
{
  "family": "my-app",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "my-app:latest",
      "environment": [
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "http://localhost:4318/v1/traces"
        }
      ],
      "dependsOn": [
        {
          "containerName": "adot-collector",
          "condition": "START"
        }
      ]
    },
    {
      "name": "adot-collector",
      "image": "amazon/aws-otel-collector:latest",
      "environment": [
        {
          "name": "AWS_REGION",
          "value": "ap-northeast-2"
        }
      ],
      "firelensConfiguration": {
        "type": "fluentd"
      }
    }
  ]
}
```

### SDK 설정

```typescript
import { TelemetryRuntime } from '@croco/telemetry-sdk-node';

await telemetry.init({
  serviceName: 'my-service',
  trace: {
    exporterUrl: 'http://localhost:4318/v1/traces', // ADOT Collector
  },
});
```

---

## Lambda 예제

### REST API (API Gateway)

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';
import { createHttpHandler } from '@croco/transports-http';
import { Controller, Get, Post } from '@croco/protocols-rest';
import { Trace } from '@croco/telemetry-api';

// SDK 초기화 (전역 스코프)
const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'user-api',
  probability: process.env.STAGE === 'prod' ? 0.05 : 1.0,
}));

// 컨트롤러
@Controller('/users')
class UserController {
  @Get('/:id')
  @Trace()
  async getUser(@Param('id') id: string) {
    return { id, name: 'John Doe' };
  }

  @Post('/')
  @Trace({ name: 'user.create' })
  async createUser(@Body() dto: CreateUserDto) {
    return { id: '123', ...dto };
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
import { Trace, recordEvent } from '@croco/telemetry-api';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'order-processor',
  probability: 0.1, // 10% 샘플링
}));

@Trace({ name: 'sqs.process-message' })
async processMessage(body: string) {
  const message = JSON.parse(body);

  recordEvent('message.parsed', { 'message.id': message.id });

  // 비즈니스 로직
  await handleOrder(message);

  recordEvent('message.processed', { 'message.id': message.id });
}

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    await processMessage(record.body);
  }

  await telemetry.forceFlush();
};
```

### EventBridge Rule

```typescript
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';
import { Trace, recordEvent } from '@croco/telemetry-api';

const telemetry = TelemetryRuntime.getInstance();
await telemetry.init(lambdaPreset({
  serviceName: 'notification-sender',
}));

@Trace()
async sendNotification(event: EventBridgeEvent) {
  recordEvent('notification.sending', {
    'type': event['detail-type'],
    'recipient': event.detail.recipient,
  });

  await notificationService.send(event.detail);

  recordEvent('notification.sent', {
    'recipient': event.detail.recipient,
  });
}

export const handler = async (event: EventBridgeEvent) => {
  await sendNotification(event);

  await telemetry.forceFlush();
};
```

---

## 모범 사례

### 1. 샘플링 전략

프로덕션 환경에서는 샘플링을 통해 비용을 절감하세요.

```typescript
const probability = {
  development: 1.0,   // 100%
  staging: 0.5,       // 50%
  production: 0.05,   // 5%
}[process.env.NODE_ENV ?? 'development'];

await telemetry.init(lambdaPreset({
  serviceName: 'my-service',
  probability,
}));
```

### 2. 중첩된 추적

메서드가 다른 메서드를 호출하면 자동으로 중첩된 Span이 생성됩니다.

```typescript
@Service()
class OrderService {
  @Trace({ name: 'order.create' })
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // 부모 Span: order.create

    const user = await this.userService.getUser(dto.userId); // 자식 Span: user.get
    const payment = await this.paymentService.process(dto.payment); // 자식 Span: payment.process

    return this.saveOrder(order);
  }
}
```

### 3. 속성 추가

비즈니스에 의미 있는 속성을 추가하세요.

```typescript
@Trace({
  name: 'order.create',
  attributes: {
    'order.tier': 'premium', // 비즈니스 속성
    'user.segment': 'vip',   // 사용자 세그먼트
  }
})
async createOrder(dto: CreateOrderDto) {
  // ...
}
```

### 4. 에러 핸들링

에러를 기록하고 다시 throw하세요.

```typescript
@Trace()
async riskyOperation() {
  try {
    await doSomethingRisky();
  } catch (error) {
    recordError(error); // 에러 기록
    throw error;        // 다시 throw
  }
}
```

### 5. Lambda 환경 최적화

Lambda 환경에서는 `forceFlush()`를 호출하여 데이터 전송을 보장하세요.

```typescript
export const handler = async (event: any) => {
  try {
    return await processEvent(event);
  } finally {
    await telemetry.forceFlush(); // 필수
  }
};
```

### 6. 환경별 설정

```typescript
// config/telemetry.ts
export const telemetryConfig = lambdaPreset({
  serviceName: 'my-service',
  probability: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  exporterUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  exporterHeaders: {
    'X-Environment': process.env.NODE_ENV,
  },
});
```

### 7. 주의사항

- **AWS_LAMBDA_EXEC_WRAPPER 사용 금지**: Croco 방식을 따르세요
- **필수 forceFlush**: Lambda 핸들러에서 항상 호출
- **과도한 샘플링 피하기**: 프로덕션에서는 1~10% 권장
- **민감 정보 기록 금지**: Span에 비밀번호, 토큰 등을 기록하지 마세요

---

## 추가 리소스

- **[@croco/telemetry-api](../packages/telemetry-api/README.md)**: API 문서
- **[@croco/telemetry-sdk-node](../packages/telemetry-sdk-node/README.md)**: SDK 문서
- **OpenTelemetry 문서**: https://opentelemetry.io/docs/
- **AWS Distro for OpenTelemetry**: https://aws-otel.github.io/

## 라이선스

MIT License. Copyright (c) 2026 Croco Team.
