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

### 실패 재시도와 DLQ 재생

```typescript
import type { DeadLetterPolicy, RetryableEventHandler } from "@croco/events-core";
import { InMemoryDeadLetterQueue, InMemoryEventBus } from "@croco/events-inmemory";

class UserCreatedHandler implements RetryableEventHandler {
  getRetryPolicy(): Partial<DeadLetterPolicy> {
    return { maxRetries: 2, retryDelayMs: 100 };
  }

  async handle(): Promise<void> {
    // event handling
  }
}

const deadLetterQueue = new InMemoryDeadLetterQueue();
const eventBus = new InMemoryEventBus({ deadLetterQueue });

// 운영자가 실패 원인을 해소한 뒤 호출합니다.
const replay = await eventBus.replayDeadLetters(10);
console.log(replay.succeeded, replay.failed);
```

DLQ 설정은 명시적으로 opt-in합니다. 설정하지 않으면 기존처럼 각 핸들러를 한 번 실행하고 실패를
`EventPublishFailedError`로 반환합니다. 설정하면 기본 정책을 적용하며, `RetryableEventHandler`가 반환한 값이 버스
정책보다 우선합니다. 소진된 항목은 원래 `eventId`와 실패한 핸들러 ID를 보존합니다. 재생은 그 핸들러만 다시 실행해
이미 성공한 핸들러의 부작용을 반복하지 않습니다.

`InMemoryDeadLetterQueue`는 프로세스 로컬 FIFO 구현입니다. 같은 이벤트·핸들러 항목을 중복 저장하지 않고,
`dequeue`한 항목을 원자적으로 제거하며, 실패한 재생은 누적 재시도 횟수와 함께 다시 저장됩니다. 영속성이나 다중
프로세스 조정이 필요하면 `DeadLetterQueue` 계약을 구현한 외부 저장소 어댑터를 주입해야 합니다.

## API 레퍼런스

- `InMemoryEventBus`: `publish`, `replayDeadLetters`, `subscribe`, `unsubscribe`, `clear` 제공
- `InMemoryDeadLetterQueue`: 프로세스 로컬 FIFO·중복 제거·보관 기간 처리
- `InMemoryEventBusOptions`: 동시성, 백프레셔, `deadLetterQueue`, `deadLetterPolicy` 설정
- `BackpressureStrategy`: `drop`, `block`, `error`
- `EventPublishFailedError`: 핸들러 실패를 집계해 반환하는 에러
- `EventPublishDroppedProblem`: `drop` 전략으로 생략된 발행의 전달/누락 수와 선행 핸들러 실패를 제공하는 Problem
- `BackpressureExceededProblem`: 동시성 한도 초과 시 발생하는 Problem
- `BackpressureTimeoutProblem`: `block` 전략의 슬롯 대기가 제한 시간을 초과하면 발생하는 Problem
- `InvalidEventBusConfigurationProblem`: 잘못된 동시성 또는 timeout 설정을 생성 시점에 거부하는 Problem
- `InvalidDeadLetterPolicyProblem`: 실행할 수 없는 재시도·보관 정책을 거부하는 Problem
- `DeadLetterQueueNotConfiguredProblem`: DLQ 없이 정책 또는 재생을 요청하면 발생하는 Problem
- `DeadLetterReplayHandlerUnavailableProblem`: 기록된 핸들러를 고유하게 찾을 수 없을 때 재생 항목을 보존하는 Problem

## 동작 특징

- `maxConcurrency`는 `1`부터 `Number.MAX_SAFE_INTEGER`까지의 정수이며 기본값은 `100`
- `backpressureTimeoutMs`는 `1`부터 `2_147_483_647`까지의 정수이며 기본값은 `5000`
- 잘못된 숫자 설정은 이벤트를 발행하기 전에 `InvalidEventBusConfigurationProblem`으로 거부
- `block` 전략은 슬롯이 생길 때까지 대기하되, `backpressureTimeoutMs`를 초과하면 Problem을 발생
- `drop` 전략은 일부 또는 전체 구독자를 생략하면 `EventPublishDroppedProblem`으로 발행을 거부
- `error` 전략은 즉시 Problem을 발생
- OpenTelemetry 활성 시 발행 Span과 핸들러 Span을 자동 기록
- Runtime Inspector의 재시도·enqueue·재생 진단에는 event/handler ID, 횟수, 오류 이름만 기록하고 payload와 오류
  메시지는 기록하지 않음
