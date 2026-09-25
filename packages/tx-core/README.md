# @croco/tx-core

AsyncLocalStorage 기반 Unit of Work 계층입니다. 트랜잭션 컨텍스트, 중첩 전략, 전파 규칙, after-commit 훅을 제공합니다.

## 설치

```bash
pnpm add @croco/tx-core @croco/framework-context
```

## 사용법

### TxManager로 수동 실행

```typescript
import { TxManager, type TxAdapter } from "@croco/tx-core";

const adapter: TxAdapter<unknown> = {
  async transaction(fn) {
    return fn({});
  },
  async savepoint(client, fn) {
    return fn(client);
  },
  supportsSavepoint() {
    return true;
  },
};

const txManager = new TxManager(adapter, { defaultNesting: "join", defaultTimeout: 5000 });
await txManager.run(async () => undefined);
```

`run()`은 어댑터가 커밋한 값을 그대로 반환하는 transaction-only 경로입니다. 이 경로와
`@Transactional`에서는 post-commit 실패 증거를 반환할 수 없으므로 `onAfterCommit()` 등록을
커밋 전에 `AfterCommitOutcomeRequiredProblem`으로 거부합니다.

후속 전달 작업이 필요하면 `runWithOutcome()`을 사용해 커밋 값과 구조화된 훅 결과를 함께 받습니다.
이 경로는 모든 훅과 reporting 시도를 실행하며, 훅·reporting 실패가 커밋 뒤 rejection으로 바뀌지
않도록 degraded evidence로 반환합니다. 호출자는 이 evidence를 재시도 저장소나 운영 증거에 기록해야
합니다. decorator 기반 작업에서 후속 전달이 필요하면 durable transactional outbox를 사용하거나
수동 `runWithOutcome()` 경계로 전환합니다.

```typescript
const outcome = await txManager.runWithOutcome(async () => {
  txManager.onAfterCommit(() => publishOrder());
  return createOrder();
});

if (outcome.afterCommit.status === "failed") {
  await retryStore.save(outcome.afterCommit.failures);
}
```

트랜잭션 callback이 끝나면 hook 등록도 닫힙니다. callback에서 분리된 timer나 Promise가 나중에
`onAfterCommit()`을 호출하면 `AfterCommitRegistrationClosedProblem`으로 거부되어 전달 작업이
성공 outcome 뒤에 조용히 유실되지 않습니다.
루트 callback이 끝날 때 await되지 않은 savepoint가 남아 있어도
`DetachedTransactionOperationProblem`으로 커밋 전에 거부됩니다.

같은 부모 트랜잭션의 savepoint 자식은 시작 순서대로 하나씩 실행됩니다. 다음 자식은 앞 자식의
savepoint가 release 또는 rollback된 뒤 시작합니다. 대기 시간은 자식의 `timeout`에 포함되지 않습니다.

`defaultTimeout`과 실행별 `timeout`은 1~2,147,483,647 범위의 정수 밀리초여야 합니다. 제한 시간이 필요하지
않으면 해당 옵션을 생략합니다. 잘못된 값은 트랜잭션이나 사용자 콜백이 시작되기 전에
`InvalidTransactionTimeoutProblem`으로 거부됩니다.

타임아웃은 어댑터의 트랜잭션/세이브포인트 경계에만 적용되며 after-commit 훅 실행 시간은 포함하지 않습니다.
어댑터가 제한 시간 이후에도 성공을 반환하면 이미 커밋된 결과로 처리합니다. 제한 시간 이후 취소 사유와 다른
오류가 반환되어 커밋 여부를 확정할 수 없으면 `TransactionOutcomeUnknownProblem`이 발생하며
`extensions.committed`는 `"unknown"`입니다.

사용자 정의 `TxAdapter`가 제한 시간을 안전하게 취소하면 롤백을 마친 뒤 `signal.reason`을 원인으로 갖는
`TransactionRollbackConfirmedProblem`으로 거부해야 합니다. 성공 반환은 커밋 완료를 의미해야 합니다.

### `@Transactional` 데코레이터 사용

```typescript
import { Transactional, TxManager } from "@croco/tx-core";

class OrderService {
  constructor(readonly txManager: TxManager) {}

  @Transactional((service: OrderService) => service.txManager, {
    propagation: "REQUIRES_NEW",
    timeout: 10000,
  })
  async placeOrder(): Promise<void> {}
}
```

매니저는 생성자로 주입하고 데코레이터의 첫 번째 인자에서 수신 객체의 매니저를 선택합니다.
이름별 매니저가 필요하면 애플리케이션이 소유한 `new TxManagerRegistry()`를 주입한 뒤
`(service: OrderService) => service.registry.get("billing")`처럼 선택합니다.
레지스트리는 전역 Container에 매니저를 등록하지 않습니다.

## API 레퍼런스

- `TxAdapter`: 루트 트랜잭션과 savepoint 생성 계약
- `TxManager`: `run`, `runWithOutcome`, `getClient`, `isInTransaction`, `onAfterCommit`, `suspend`
- `Transactional`: 메서드 단위 트랜잭션 데코레이터
- `TxManagerRegistry`, `DEFAULT_TX_MANAGER_KEY`: 다중 매니저 등록과 조회
- 타입: `TxRunOptions`, `TxRunOutcome`, `AfterCommitOutcome`, `TxManagerConfig`, `TransactionalOptions`,
  `Propagation`, `NestingStrategy`
- Problem: `TransactionTimeoutProblem`, `InvalidTransactionTimeoutProblem`, `TransactionContextProblem`,
  `AfterCommitHooksProblem`, `AfterCommitOutcomeRequiredProblem`, `AfterCommitRegistrationClosedProblem`,
  `DetachedTransactionOperationProblem`, `TransactionOutcomeUnknownProblem`, `TransactionRollbackConfirmedProblem`,
  `TxPropagationError`

## 전파 규칙

- `REQUIRED`: 기존 트랜잭션에 참여, 없으면 새로 시작
- `REQUIRES_NEW`: 현재 컨텍스트를 중단하고 새 트랜잭션 시작
- `MANDATORY`: 기존 트랜잭션이 없으면 오류
- `NEVER`: 트랜잭션 안에서 호출되면 오류
