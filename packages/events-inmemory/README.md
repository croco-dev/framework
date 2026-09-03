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
const eventBus = new InMemoryEventBus({
  maxConcurrency: 10,
  backpressureStrategy: "block",
  backpressureTimeoutMs: 5000,
});
config.setEventBus(eventBus);

const result = await eventBus.shutdown({ timeoutMs: 10_000 });
if (result.status !== "drained") {
  console.error(result.unfinishedHandlers);
}
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
eventBus.subscribe({
  eventName: "user.created",
  handlerClass: UserCreatedHandler,
  handlerId: "users.created.v1",
});

// 운영자가 실패 원인을 해소한 뒤 호출합니다.
const replay = await eventBus.replayDeadLetters(10);
console.log(replay.succeeded, replay.failed);
```

DLQ 설정은 명시적으로 opt-in합니다. 설정하지 않으면 기존처럼 각 핸들러를 한 번 실행하고 실패를
`EventPublishFailedError`로 반환합니다. 설정하면 기본 정책을 적용하며, `RetryableEventHandler`가 반환한 값이 버스
정책보다 우선합니다. 소진된 항목은 원래 `eventId`와 실패한 핸들러 ID를 보존합니다. 재생은 그 핸들러만 다시 실행해
이미 성공한 핸들러의 부작용을 반복하지 않습니다.
핸들러를 DI에서 생성하지 못한 경우에는 `handler-resolution-failed` 원인과 재시도 횟수 0으로 항목을 저장합니다.
이때 핸들러 정책은 호출하지 않으며, 버스의 보관 기간을 적용합니다. 의존성 등록 문제를 해결한 뒤 재생할 수 있습니다.

`InMemoryDeadLetterQueue`는 프로세스 로컬 FIFO 구현입니다. 같은 이벤트·핸들러 항목을 중복 저장하지 않고,
`dequeue`한 항목을 원자적으로 제거하며, 실패한 재생은 누적 재시도 횟수와 함께 다시 저장됩니다. 영속성이나 다중
프로세스 조정이 필요하면 `DeadLetterQueue` 계약을 구현한 외부 저장소 어댑터를 주입해야 합니다.

DLQ 경로는 이벤트 클래스의 prototype과 원본 identity를 유지하며, payload와 메타데이터를 참조 공유 없이 복사합니다.
지원 값은 primitive 데이터(symbol 제외), 일반 객체·null-prototype 객체, 배열, `Date`, `RegExp`, `Map`, `Set`입니다.
순환 참조와 열거 가능한 symbol key도 보존합니다. 사용자 정의 중첩 인스턴스, 함수, binary buffer/view 등 지원하지 않는
값은 `UnsupportedDeadLetterValueProblem`으로 거부합니다. 지원 데이터로 변환한 뒤 다시 발행하거나 저장하세요.
이 복사 경계는 DLQ 미설정 발행에는 적용하지 않습니다.

DLQ를 사용하는 버스는 구독에 비어 있지 않은 `handlerId`를 명시해야 합니다. 클래스 이름은 ID로 사용하지 않으므로
클래스 이름이 바뀌거나 코드가 minify되어도 같은 `handlerId`를 유지하면 저장된 항목을 재생할 수 있습니다.
`RegisterEventHandler(EventClass, { handlerId: "users.created.v1" })`로 선언한 ID도 `EventBusConfig.start()`가 전달합니다.
한 버스에서 같은 ID를 서로 다른 클래스에 부여하거나 한 클래스에 여러 ID를 부여할 수 없습니다. 이 연결은
`unsubscribe`나 `clear` 후에도 유지됩니다. 같은 클래스·ID의 재등록과 여러 이벤트 패턴 구독은 가능합니다.
기존 저장 항목이 남아 있는 동안에는 ID를 다른 처리 용도로 재사용하지 마세요.

재생에도 `maxConcurrency`와 대기 timeout이 적용됩니다. `error`·`drop` 전략에서 슬롯이 없으면 항목을 실행하지 않고
실패로 반환해 다시 저장합니다. 이미 꺼낸 배치의 한 항목이 실패해도 나머지 항목은 계속 처리합니다.
`failures`의 `error`는 실행 실패, `storageError`는 재저장 실패를 나타냅니다. `requeued: false`이면 호출자가 반환된
`item`을 보관하고 저장소 복구 후 다시 저장해야 합니다. `item`에는 이벤트 payload가 있으므로 진단 로그에 출력하지
마세요. 어댑터의 `dequeue`는 반환 전에 항목을 원자적으로 제거해야 하며, 별도 성공 확인이 필요한 lease 방식은 지원하지 않습니다.

## API 레퍼런스

- `InMemoryEventBus`: `publish`, `replayDeadLetters`, `subscribe`, `unsubscribe`, `clear`, `shutdown` 제공
- `InMemoryDeadLetterQueue`: 프로세스 로컬 FIFO·중복 제거·보관 기간 처리
- `InMemoryEventBusOptions`: 동시성, 백프레셔, `deadLetterQueue`, `deadLetterPolicy` 설정
- `BackpressureStrategy`: `drop`, `block`, `error`
- `EventPublishFailedError`: 핸들러 실패를 집계해 반환하는 에러
- `EventPublishDroppedProblem`: `drop` 전략으로 생략된 발행의 전달/누락 수와 선행 핸들러 실패를 제공하는 Problem
- `BackpressureExceededProblem`: 동시성 한도 초과 시 발생하는 Problem
- `BackpressureTimeoutProblem`: `block` 전략의 슬롯 대기가 제한 시간을 초과하면 발생하는 Problem
- `InvalidEventBusConfigurationProblem`: 잘못된 동시성 또는 timeout 설정을 생성 시점에 거부하는 Problem
- `InvalidBackpressureStrategyProblem`: `block`, `drop`, `error` 외의 전략 값을 생성 시점에 거부
- `UnsupportedDeadLetterValueProblem`: 안전하게 복사할 수 없는 DLQ payload·메타데이터 값을 거부
- `InvalidDeadLetterPolicyProblem`: 실행할 수 없는 재시도·보관 정책을 거부하는 Problem
- `DeadLetterQueueNotConfiguredProblem`: DLQ 없이 정책 또는 재생을 요청하면 발생하는 Problem
- `DeadLetterReplayHandlerUnavailableProblem`: 기록된 핸들러를 고유하게 찾을 수 없을 때 재생 항목을 보존하는 Problem
- `InvalidDeadLetterHandlerIdentityProblem`: DLQ 핸들러 ID가 없거나 비어 있거나 클래스와 일관되게 연결되지 않으면 등록을 거부
- `InvalidDeadLetterRetryCountProblem`: 누적 재시도 횟수와 재생 예산이 안전한 정수 범위를 벗어나면 실행을 거부

## 동작 특징

- `maxConcurrency`는 `1`부터 `Number.MAX_SAFE_INTEGER`까지의 정수이며 기본값은 `100`
- `backpressureTimeoutMs`는 `1`부터 `2_147_483_647`까지의 정수이며 기본값은 `5000`
- 잘못된 숫자 설정은 이벤트를 발행하기 전에 `InvalidEventBusConfigurationProblem`으로 거부
- `shutdown`은 즉시 새 publish intake와 슬롯 대기를 닫고, 이미 시작된 핸들러만 제한 시간까지 drain
- drain timeout 또는 cancellation은 `unfinishedHandlers` snapshot과 함께 구분된 결과로 반환
- shutdown 이후 publish는 `EventBusIntakeClosedProblem`으로 거부
- `block` 전략은 슬롯이 생길 때까지 대기하되, `backpressureTimeoutMs`를 초과하면 Problem을 발생
- `drop` 전략은 일부 또는 전체 구독자를 생략하면 `EventPublishDroppedProblem`으로 발행을 거부
- `error` 전략은 즉시 Problem을 발생
- OpenTelemetry 활성 시 발행 Span과 핸들러 Span을 자동 기록
- Runtime Inspector의 재시도·enqueue·재생 진단에는 event/handler ID, 횟수, 오류 이름만 기록하고 payload와 오류
  메시지는 기록하지 않음
