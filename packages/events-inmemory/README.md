# @croco/events-inmemory

`@croco/events-core`용 인메모리 이벤트 버스 구현체입니다. TypeDI와 통합되며, 동시 실행 수를 제한하고 백프레셔를 제어할 수 있습니다.

## 설치

```bash
pnpm add @croco/events-inmemory @croco/events-core typedi reflect-metadata
```

## 사용법

```typescript
import "reflect-metadata";
import { EventBusConfig } from "@croco/events-core";
import { InMemoryEventBus } from "@croco/events-inmemory";

const config = EventBusConfig.getInstance();
config.setEventBus(
  new InMemoryEventBus({
    maxConcurrency: 10,
    backpressureStrategy: "block",
  }),
);
```

## API 레퍼런스

- `InMemoryEventBus`: `publish`, `subscribe`, `unsubscribe`, `clear` 제공
- `InMemoryEventBusOptions`: `maxConcurrency`, `backpressureStrategy`
- `BackpressureStrategy`: `drop`, `block`, `error`
- `EventPublishFailedError`: 핸들러 실패를 집계해 반환하는 에러
- `BackpressureExceededProblem`: 동시성 한도 초과 시 발생하는 Problem

## 동작 특징

- 기본 `maxConcurrency`는 `100`
- `block` 전략은 슬롯이 생길 때까지 대기
- `drop` 전략은 초과 이벤트를 조용히 무시
- `error` 전략은 즉시 Problem을 발생
- OpenTelemetry 활성 시 발행 Span과 핸들러 Span을 자동 기록
