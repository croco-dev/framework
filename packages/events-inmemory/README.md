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
    backpressureTimeoutMs: 5000,
  }),
);
```

## API 레퍼런스

- `InMemoryEventBus`: `publish`, `subscribe`, `unsubscribe`, `clear` 제공
- `InMemoryEventBusOptions`: `maxConcurrency`, `backpressureStrategy`, `backpressureTimeoutMs`
- `BackpressureStrategy`: `drop`, `block`, `error`
- `EventPublishFailedError`: 핸들러 실패를 집계해 반환하는 에러
- `EventPublishDroppedProblem`: `drop` 전략으로 생략된 발행의 전달/누락 수와 선행 핸들러 실패를 제공하는 Problem
- `BackpressureExceededProblem`: 동시성 한도 초과 시 발생하는 Problem
- `BackpressureTimeoutProblem`: `block` 전략의 슬롯 대기가 제한 시간을 초과하면 발생하는 Problem
- `InvalidEventBusConfigurationProblem`: 잘못된 동시성 또는 timeout 설정을 생성 시점에 거부하는 Problem

## 동작 특징

- `maxConcurrency`는 `1`부터 `Number.MAX_SAFE_INTEGER`까지의 정수이며 기본값은 `100`
- `backpressureTimeoutMs`는 `1`부터 `2_147_483_647`까지의 정수이며 기본값은 `5000`
- 잘못된 숫자 설정은 이벤트를 발행하기 전에 `InvalidEventBusConfigurationProblem`으로 거부
- `block` 전략은 슬롯이 생길 때까지 대기하되, `backpressureTimeoutMs`를 초과하면 Problem을 발생
- `drop` 전략은 일부 또는 전체 구독자를 생략하면 `EventPublishDroppedProblem`으로 발행을 거부
- `error` 전략은 즉시 Problem을 발생
- OpenTelemetry 활성 시 발행 Span과 핸들러 Span을 자동 기록
