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

`defaultTimeout`과 실행별 `timeout`은 1~2,147,483,647 범위의 정수 밀리초여야 합니다. 제한 시간이 필요하지
않으면 해당 옵션을 생략합니다. 잘못된 값은 트랜잭션이나 사용자 콜백이 시작되기 전에
`InvalidTransactionTimeoutProblem`으로 거부됩니다.

### `@Transactional` 데코레이터 사용

```typescript
import { Transactional } from "@croco/tx-core";

class OrderService {
  @Transactional({ propagation: "REQUIRES_NEW", timeout: 10000 })
  async placeOrder(): Promise<void> {}
}
```

## API 레퍼런스

- `TxAdapter`: 루트 트랜잭션과 savepoint 생성 계약
- `TxManager`: `run`, `getClient`, `isInTransaction`, `onAfterCommit`, `suspend`
- `Transactional`: 메서드 단위 트랜잭션 데코레이터
- `TxManagerRegistry`, `DEFAULT_TX_MANAGER_KEY`: 다중 매니저 등록과 조회
- 타입: `TxRunOptions`, `TxManagerConfig`, `TransactionalOptions`, `Propagation`, `NestingStrategy`
- Problem: `TransactionTimeoutProblem`, `InvalidTransactionTimeoutProblem`, `TransactionContextProblem`,
  `AfterCommitHooksProblem`, `TxPropagationError`

## 전파 규칙

- `REQUIRED`: 기존 트랜잭션에 참여, 없으면 새로 시작
- `REQUIRES_NEW`: 현재 컨텍스트를 중단하고 새 트랜잭션 시작
- `MANDATORY`: 기존 트랜잭션이 없으면 오류
- `NEVER`: 트랜잭션 안에서 호출되면 오류
