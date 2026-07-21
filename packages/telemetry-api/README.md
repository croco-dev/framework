# @croco/telemetry-api

애플리케이션 코드에서 사용하는 OpenTelemetry 추적 API입니다. SDK 초기화는 `@croco/telemetry-sdk-node`가 담당하고, 이 패키지는 Span 생성과 이벤트 기록을 담당합니다.

## 설치

```bash
pnpm add @croco/telemetry-api @opentelemetry/api
```

## 사용법

### `@Trace` 데코레이터

```typescript
import { Trace } from "@croco/telemetry-api";

class OrderService {
  @Trace({ name: "order.create" })
  async createOrder(): Promise<void> {}
}
```

### `withSpan`과 이벤트 기록

```typescript
import { recordEvent, withSpan } from "@croco/telemetry-api";

await withSpan(async (span) => {
  span.setAttribute("feature", "checkout");
  recordEvent("checkout.started");
});
```

### 현재 Trace 정보 읽기

```typescript
import { getActiveTraceInfo } from "@croco/telemetry-api";

const traceInfo = getActiveTraceInfo();
```

### 브라우저 RPC correlation bridge

```typescript
import { createFrontendTelemetryBridge } from "@croco/telemetry-api";
import { userClient } from "./generated/rpc";

const bridge = createFrontendTelemetryBridge({
  sink: {
    record: (event) => {
      console.debug(event.kind, event.routeId, event.status);
    },
  },
});

await userClient.getUser(
  { path: { id: "user-1" } },
  {
    telemetry: bridge,
    interactionId: bridge.interactionId,
    correlationId: bridge.correlationId,
  },
);
```

`createFrontendTelemetryBridge()` is browser-safe and does not initialize an SDK or import
`@croco/telemetry-sdk-node`. Generated RPC clients can use it to attach `traceparent`,
`x-croco-correlation-id`, and `x-croco-interaction-id` headers without app-local fetch wrappers.
Generated clients emit telemetry without awaiting the sink, so awaiting an RPC call does not imply
that an asynchronous sink has settled. Direct callers can await `bridge.record(event)` and handle
sink rejection when delivery completion is part of their own workflow.

Frontend telemetry events intentionally carry route metadata, latency, HTTP status, retry/cancel
markers, and stable Problem metadata (`code`, `status`, `category`, `type`, `title`). They do not
include request bodies, query values, raw headers, response bodies, credentials, or Problem
`detail`/`instance` fields. Send only redacted, provider-approved payloads from the sink.

## API 레퍼런스

- `Trace`: 비동기 메서드를 Span으로 감싸는 데코레이터
- `withSpan`: 수동 Span 실행 유틸리티
- `recordEvent`: 현재 활성 Span에 이벤트 추가
- `recordError`: 현재 활성 Span에 에러 기록
- `getActiveTraceInfo`: 현재 traceId, spanId, traceFlags 조회
- `getTracer`: 수동 Span 생성용 Tracer 반환
- `createFrontendTelemetryBridge`: 브라우저 RPC correlation header/event bridge 생성
- `createFrontendInteractionId`: 브라우저 interaction id 생성
- 타입: `TraceDecoratorOptions`, `SpanOptions`, `TraceInfo`, `TracerOptions`,
  `FrontendTelemetryBridge`, `FrontendTelemetryEvent`, `FrontendTelemetrySink`

## 참고

- 이 패키지만 단독으로 사용하면 Span이 전송되지 않습니다.
- 애플리케이션 시작 시 `@croco/telemetry-sdk-node`로 먼저 SDK를 초기화해야 합니다.
