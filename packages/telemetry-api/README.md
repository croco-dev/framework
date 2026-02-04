# @croco/telemetry-api

Croco 프레임워크를 위한 OpenTelemetry Tracing API입니다.

이 패키지는 **OpenTelemetry 표준을 기반으로 한 간단한 추적 API**를 제공합니다. 애플리케이션 코드에서 분산 추적(Distributed Tracing)을 사용할 수 있는 데코레이터와 유틸리티 함수를 포함합니다.

## 설치

```bash
pnpm add @croco/telemetry-api
```

## 개요

### API vs SDK

Croco의 Telemetry는 두 개의 패키지로 분리되어 있습니다:

- **`@croco/telemetry-api`** (이 패키지): 애플리케이션 코드에서 사용하는 API
  - `@Trace` 데코레이터
  - `withSpan`, `recordError`, `recordEvent` 함수
  - `getTracer`, `getActiveTraceInfo` 유틸리티

- **`@croco/telemetry-sdk-node`**: 애플리케이션 시작 시 초기화하는 SDK
  - OpenTelemetry SDK 초기화
  - OTLP Trace Exporter 설정
  - Lambda, ECS 등 환경별 Preset

**중요**: 이 패키지만 단독으로 사용하는 것은 의미가 없습니다. 반드시 `@croco/telemetry-sdk-node`로 먼저 초기화해야 추적이 동작합니다.

## 주요 API

### 1. `@Trace` 데코레이터

비동기 메서드 실행을 자동으로 추적하는 데코레이터입니다.

```typescript
import { Trace } from '@croco/telemetry-api';

class OrderService {
  @Trace({ name: 'place-order' })
  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    // 메서드 실행이 자동으로 Span으로 감싸집니다
    // 에러 발생 시 자동으로 기록되고 다시 throw됩니다
    return this.repository.save(dto);
  }
}
```

#### 옵션

```typescript
interface TraceDecoratorOptions {
  name?: string; // Span 이름 (기본값: 메서드 이름)
  attributes?: Attributes; // 추가 속성
}
```

**예시 - 커스텀 속성 추가:**

```typescript
class PaymentService {
  @Trace({
    name: 'process-payment',
    attributes: { 'service.type': 'payment' }
  })
  async processPayment(amount: number): Promise<void> {
    // ...
  }
}
```

### 2. `withSpan` 함수

함수 실행을 Span으로 감싸는 유틸리티입니다.

```typescript
import { withSpan } from '@croco/telemetry-api';

const result = await withSpan(async (span) => {
  // span 인스턴스에 직접 접근 가능
  span.setAttribute('user.id', userId);

  const data = await fetchData();
  return data;
}, {
  name: 'fetch-data',
  attributes: { 'source': 'external-api' }
});
```

#### 함수 시그니처

```typescript
async function withSpan<T>(
  fn: (span: Span) => Promise<T> | T,
  options?: SpanOptions
): Promise<T>

interface SpanOptions {
  name?: string;
  attributes?: Attributes;
}
```

### 3. `recordError` 함수

현재 Span에 에러를 기록합니다.

```typescript
import { recordError } from '@croco/telemetry-api';

try {
  await riskyOperation();
} catch (error) {
  recordError(error); // 현재 활성 Span에 에러 기록
  throw error; // 에러를 다시 throw해야 합니다
}
```

#### 특정 Span에 에러 기록

```typescript
await withSpan(async (span) => {
  try {
    await operation();
  } catch (error) {
    recordError(error, span); // 특정 Span에 에러 기록
    throw error;
  }
}, { name: 'operation' });
```

### 4. `recordEvent` 함수

현재 Span에 이벤트를 기록합니다.

```typescript
import { recordEvent } from '@croco/telemetry-api';

@Trace()
async processOrder() {
  // 비즈니스 이벤트 기록
  recordEvent('order.validated', { 'order.id': orderId });
  recordEvent('inventory.reserved', { 'sku': sku, 'quantity': qty });
}
```

### 5. `getActiveTraceInfo` 함수

현재 활성화된 Trace의 컨텍스트 정보를 가져옵니다.

```typescript
import { getActiveTraceInfo } from '@croco/telemetry-api';

@Trace()
async handleRequest() {
  const traceInfo = getActiveTraceInfo();
  console.log('Trace ID:', traceInfo.traceId);
  console.log('Span ID:', traceInfo.spanId);
  console.log('Is Sampled:', traceInfo.isValid);

  // 로그에 Trace ID 포함
  logger.info('Processing request', { traceId: traceInfo.traceId });
}
```

#### 반환 값

```typescript
interface TraceInfo {
  traceId?: string;   // Trace ID
  spanId?: string;    // 현재 Span ID
  traceFlags?: number; // Trace 플래그
  isValid?: boolean;  // 샘플링 여부
}
```

### 6. `getTracer` 함수

OpenTelemetry Tracer 인스턴스를 가져옵니다. 고급 사용자용입니다.

```typescript
import { getTracer } from '@croco/telemetry-api';

const tracer = getTracer({
  name: 'my-service',
  version: '1.0.0'
});

// 직접 Tracer 사용 (일반적으로 필요하지 않음)
const span = tracer.startSpan('manual-span');
try {
  // 작업 수행
} finally {
  span.end();
}
```

## 사용 패턴

### 서비스 클래스에서 추적

```typescript
import { Trace } from '@croco/telemetry-api';
import { Service } from '@croco/framework-context';

@Service()
class UserService {
  @Trace({ name: 'user.create' })
  async createUser(dto: CreateUserDto): Promise<User> {
    // 자동으로 추적됨
    return this.userRepository.save(dto);
  }

  @Trace()
  async deleteUser(userId: string): Promise<void> {
    // 메서드 이름으로 자동 추적됨
    await this.userRepository.delete(userId);
  }
}
```

### 중첩된 추적

```typescript
@Service()
class OrderService {
  @Trace({ name: 'order.create' })
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // 부모 Span: order.create

    const user = await this.getUser(dto.userId); // 자식 Span: getUser
    const payment = await this.processPayment(dto.amount); // 자식 Span: processPayment

    return this.saveOrder(order);
  }

  @Trace()
  async getUser(userId: string) {
    // 자식 Span: getUser
  }

  @Trace()
  async processPayment(amount: number) {
    // 자식 Span: processPayment
  }
}
```

### 속성 추가

```typescript
import { withSpan, recordEvent } from '@croco/telemetry-api';

@Trace()
async processOrder(orderId: string) {
  // Span에 속성 추가
  recordEvent('order.started', { 'order.id': orderId });

  await withSpan(async (span) => {
    span.setAttribute('operation', 'inventory-check');
    await this.checkInventory();
  }, { name: 'inventory.check' });
}
```

## OpenTelemetry 호환성

이 패키지는 OpenTelemetry 표준 API를 기반으로 합니다:

- **OpenTelemetry API**: `@opentelemetry/api`
- **Trace Propagation**: W3C Trace Context 표준 지원
- **Span 상태**: OpenTelemetry SpanStatusCode 준수

## 관련 패키지

- **[@croco/telemetry-sdk-node](../telemetry-sdk-node/)**: SDK 초기화 및 설정
- **OpenTelemetry 문서**: https://opentelemetry.io/docs/concepts/observability-primer/

## 라이선스

MIT License. Copyright (c) 2026 Croco Team.
