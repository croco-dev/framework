# @croco/execution-core

## Continuation lease configuration

`ExecutionManagerImpl` uses a 30,000 ms continuation lease by default. Set
`continuationLeaseDurationMs` to a positive integer from 1 ms through 2,147,483,647 ms, the
largest delay supported consistently by JavaScript timers and continuation stores. Invalid
values fail during manager construction with
`InvalidContinuationLeaseDurationProblem` (`execution/invalid-continuation-lease-duration`)
before execution or store work begins.

실행(Execution) 상태 관리 및 추적을 위한 코어 라이브러리입니다. 모든 실행 가능한 단위(Task, Batch, Workflow)의 생명주기를 관리하는 기반을 제공합니다.

## 특징

- **표준화된 실행 모델**: `pending` → `running` → `completed` / `failed` 상태 전이 모델 제공
- **상태 전이 검증**: 허용되지 않는 상태 변화를 방지하는 엄격한 검증 로직
- **재시도 관리**: 최대 시도 횟수 기반의 자동 재시도 및 상태 관리
- **진행률 추적**: 진행률 정보 자동 계산 및 추적
- **체크포인트**: 배치 작업 재개를 위한 체크포인트 관리
- **Continuation fencing**: 외부 전달 토큰, lease, fencing token으로 분산 chunk 소유권 보호
- **멱등성 지원**: idempotency key를 통한 중복 실행 방지
- **실행 로그**: 실행별 append-only 로그로 inspect 가능한 이력 제공
- **명시적 리플레이**: 실패/타임아웃 실행에서 새 실행을 생성하고 원본을 `replayOf`로 연결
- **확장 가능한 저장소**: `ExecutionStore` 인터페이스를 통해 다양한 백엔드(DynamoDB, Redis, RDBMS 등) 지원

## 설치

```bash
pnpm add @croco/execution-core
```

## 주요 개념

### Execution Status

실행 상태는 다음과 같은 흐름을 따릅니다:

- **pending**: 실행 대기 중
- **running**: 실행 중
- **completed**: 성공적으로 완료됨
- **failed**: 실패함 (재시도 소진)
- **retrying**: 일시적 실패로 재시도 대기 중
- **timed_out**: 시간 초과
- **cancelled**: 취소됨

### 상태 전이 규칙

```
pending → running | cancelled
running → completed | failed | timed_out | cancelled
failed → retrying
retrying → running | failed
timed_out → retrying
```

### ExecutionStore

실행 상태를 영속화하기 위한 추상 인터페이스입니다. 애플리케이션 요구사항에 맞는 저장소를 구현하여 주입해야 합니다.

```typescript
import type {
  ExecutionStore,
  Execution,
  ExecutionStatus,
  CreateExecutionParams,
  ListExecutionsOptions,
  ListRunningExecutionsOptions,
} from "@croco/execution-core";

export class MyDynamoExecutionStore extends ExecutionStore {
  async create(params: CreateExecutionParams): Promise<Execution> {
    // DynamoDB 저장 로직
  }

  async findById(id: string): Promise<Execution | null> {
    // DynamoDB 조회 로직
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    // idempotency key로 조회
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    // 실행 업데이트
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    // id와 현재 status를 함께 조건으로 사용한 원자적 업데이트
  }

  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    // id 오름차순으로 afterId 이후의 running 실행 조회
  }

  async list(options?: ListExecutionsOptions): Promise<Execution[]> {
    // 목록 조회
  }

  async delete(id: string): Promise<void> {
    // 삭제
  }
}
```

## 사용 방법

### 기본 실행 흐름

```typescript
import { ExecutionManagerImpl } from "@croco/execution-core";
import { MyDynamoExecutionStore } from "./MyDynamoExecutionStore";

const store = new MyDynamoExecutionStore();
const manager = new ExecutionManagerImpl(store);

// 1. 실행 생성
const execution = await manager.create({
  type: "my-task",
  payload: { userId: "123" },
  maxAttempts: 3,
  timeout: 30000, // 30초 타임아웃
});

// 2. 실행 시작
await manager.start(execution.id);

try {
  // ... 작업 수행 ...

  // 3. 성공 처리
  await manager.complete(execution.id, { result: "success" });
} catch (error) {
  // 4. 실패 처리 (자동으로 재시도 여부 판단)
  await manager.fail(execution.id, {
    message: error.message,
    retryable: error instanceof TemporaryError,
  });
}
```

### 진행률 추적

```typescript
// 진행률 업데이트 (자동으로 percent 계산)
await manager.updateProgress(execution.id, {
  current: 50,
  total: 100,
  message: "Processing items",
});

// 수동으로 percent 지정도 가능
await manager.updateProgress(execution.id, {
  current: 50,
  total: 100,
  percent: 75, // 자동 계산 무시
});
```

### 체크포인트 (배치 재개 지원)

```typescript
// 배치 처리 중 체크포인트 저장
for (let i = 0; i < items.length; i++) {
  await processItem(items[i]);

  // 매 10개마다 체크포인트
  if (i % 10 === 0) {
    await manager.checkpoint(execution.id, "lastIndex", i);
  }
}

// 실패 후 재시도 시 마지막 체크포인트부터 복구
const execution = await store.findById(executionId);
const lastIndex = execution.checkpoints?.lastIndex ?? 0;
```

### 원자적 continuation

`ExecutionManagerImpl`은 저장소가 선택적 `ExecutionContinuationStore` capability를 구현할 때
token-bound chunk 실행을 제공합니다. `claimContinuation()`은 전달 토큰과 lease를 검증하고,
이후 renew, stage, publish-confirm, complete, fail 연산은 획득한 fencing token이 현재 claim과
일치할 때만 상태를 변경합니다.

```typescript
const claimed = await manager.claimContinuation(executionId, {
  deliveryToken: continuationToken,
  workerId,
});

if (claimed.kind === "process") {
  await manager.stageContinuation(executionId, claimed.claim, {
    checkpoints,
    nextToken,
  });
}
```

오래된 전달은 `stale`, 아직 유효한 다른 worker의 claim은 `contended`로 반환됩니다. claim을
잃은 뒤의 mutation은 `execution/continuation-conflict` Problem으로 실패합니다. 저장소가 이
capability를 제공하지 않으면 `execution/continuation-unsupported` Problem이 발생하므로 runtime
fallback으로 원자성을 가장하지 않습니다.

### 멱등성 보장

```typescript
// 같은 idempotency key로 생성 시도하면 기존 실행 반환
const first = await manager.create({
  type: "payment",
  idempotencyKey: "order-123-payment",
  payload: { amount: 10000 },
});

const second = await manager.create({
  type: "payment",
  idempotencyKey: "order-123-payment", // 동일한 key
  payload: { amount: 10000 },
});

console.log(first.id === second.id); // true
```

### 재시도 처리

```typescript
// 1. 실행 시작
await manager.start(execution.id);

try {
  await riskyOperation();
} catch (error) {
  // 2. 실패 처리 (retryable=true면 자동으로 'retrying' 상태로)
  await manager.fail(execution.id, {
    message: error.message,
    retryable: true,
  });

  // 3. 명시적 재시도 상태 전이
  await manager.retry(execution.id);

  // 4. 재시도 실행
  await manager.start(execution.id); // attempts가 1 증가
}
```

### 타임아웃 처리

```typescript
// 실행 생성 시 타임아웃 설정
const execution = await manager.create({
  type: "long-task",
  timeout: 60000, // 60초
});

// 실행 중인 프로세스가 타임아웃을 소유할 때
await manager.timeout(execution.id);

// 프로세스 재시작 후에는 저장된 deadline이 지난 실행을 명시적으로 조정
const result = await manager.reconcileTimedOut({ batchSize: 100 });
console.log(result.timedOut);

// 이후 재시도 가능
await manager.retry(execution.id);
await manager.start(execution.id);
```

### 취소 처리

```typescript
// 취소 사유와 함께 실행 취소
await manager.cancel(execution.id, "User requested cancellation");

// 취소 사유는 metadata.cancellationReason에 저장됨
const execution = await store.findById(execution.id);
console.log(execution.metadata?.cancellationReason); // 'User requested cancellation'
```

### 실행 조회와 로그

```typescript
const execution = await manager.get(executionId);
const failedExecutions = await manager.list({ status: "failed", type: "billing-sync" });

await manager.recordLog(execution.id, {
  level: "warn",
  message: "Provider webhook failed; waiting for operator replay",
  data: { provider: "stripe" },
});
```

### 실패 실행 리플레이

```typescript
const replayed = await manager.replay(failedExecution.id, {
  reason: "operator replay after provider recovery",
});
const replays = await manager.list({ replayOf: failedExecution.id });

console.log(replayed.status); // 'pending'
console.log(replayed.replayOf === failedExecution.id); // true
console.log(replayed.idempotencyKey); // undefined - 리플레이는 원본 dedupe key를 복사하지 않음
console.log(replays[0].id === replayed.id); // true
```

### Jobs v1 운영 표면

`createExecutionJobsOperations`는 실행 매니저를 운영자가 쓰는 Jobs API로 감쌉니다. 목록과 상세 조회에는
실패 정책(`failurePolicy`)이 포함되어 `retrying`, `timed_out`, `retry_exhausted`,
`dead_lettered` 상태를 숨기지 않습니다.

```typescript
import { createExecutionJobsOperations, ExecutionManagerImpl } from "@croco/execution-core";

const manager = new ExecutionManagerImpl(store);
const jobs = createExecutionJobsOperations(manager);

const report = await jobs.list({ type: "billing-sync" });
const details = await jobs.show("exec_123");
const logs = await jobs.logs("exec_123");

await jobs.cancel("exec_123", { reason: "operator stop" });
await jobs.replay("exec_456", { reason: "provider restored" });
```

`jobs.replay`는 `failed` 또는 `timed_out` 실행에서만 새 `pending` 실행을 생성합니다. 새 실행은
`replayOf`로 원본을 가리키며 원본 `idempotencyKey`는 복사하지 않습니다.

## API

### ExecutionManager

| 메서드                         | 설명                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `create(params)`               | 새 실행 생성. idempotencyKey 제공 시 중복 방지                                         |
| `start(id)`                    | 실행 시작 (`running` 상태 전이). attempts 증가                                         |
| `complete(id, result?)`        | 실행 완료 (`completed` 상태 전이)                                                      |
| `fail(id, error)`              | 실행 실패. `error.retryable`과 `maxAttempts`에 따라 `failed` 또는 `retrying` 상태 전이 |
| `cancel(id, reason?)`          | 실행 취소 (`cancelled` 상태 전이)                                                      |
| `retry(id)`                    | 재시도 상태 전이 (`retrying`). 최대 시도 횟수 초과 시 에러                             |
| `updateProgress(id, progress)` | 진행률 업데이트. percent 자동 계산                                                     |
| `checkpoint(id, key, value)`   | 체크포인트 저장                                                                        |
| `timeout(id)`                  | 타임아웃 상태 전이 (`timed_out`)                                                       |
| `get(id)`                      | 실행 ID로 단일 실행 조회                                                               |
| `reconcileTimedOut(options?)`  | 저장된 deadline이 지난 `running` 실행을 안정적인 키셋 순회로 조정                      |

### ExecutionInspectionManager

| 메서드                  | 설명                                                 |
| ----------------------- | ---------------------------------------------------- |
| `get(id)`               | 실행 ID로 단일 실행 조회 (기본 매니저 계약에도 포함) |
| `list(options?)`        | 상태, 타입, 부모/리플레이 기준 실행 목록 조회        |
| `recordLog(id, params)` | 실행 inspect 로그 추가                               |

### ExecutionReplayManager

| 메서드                | 설명                                          |
| --------------------- | --------------------------------------------- |
| `replay(id, params?)` | 실패/타임아웃 실행에서 새 `pending` 실행 생성 |

### JobsOperations

| 메서드                | 설명                                |
| --------------------- | ----------------------------------- |
| `list(options?)`      | 실행 목록과 attention 요약 조회     |
| `show(id)`            | 실행 상세, 로그 수, 실패 정책 조회  |
| `logs(id)`            | append-only 실행 로그 조회          |
| `cancel(id, params?)` | 실행 취소와 취소 사유 기록          |
| `replay(id, params?)` | 실패/타임아웃 실행에서 새 실행 생성 |

### 타입

```typescript
type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying"
  | "timed_out";

interface ExecutionError {
  message: string;
  code?: string;
  stack?: string;
  retryable: boolean;
}

interface ProgressInfo {
  current: number;
  total: number;
  message?: string;
  percent?: number; // 생략 시 자동 계산
}

type ExecutionLogLevel = "debug" | "info" | "warn" | "error";

interface ExecutionLogEntry {
  timestamp: string;
  level: ExecutionLogLevel;
  message: string;
  data?: Record<string, unknown>;
}

interface Execution {
  id: string;
  type: string;
  status: ExecutionStatus;
  payload?: unknown;
  result?: unknown;
  error?: ExecutionError;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeout?: number;
  idempotencyKey?: string;
  replayOf?: string;
  logs?: ExecutionLogEntry[];
  parentId?: string;
  metadata?: Record<string, unknown>;
  checkpoints?: Record<string, unknown>;
  progress?: ProgressInfo;
}
```

## 에러 처리

`ExecutionProblem`을 통한 구조화된 에러 처리를 제공합니다:

```typescript
import { ExecutionProblems, ExecutionProblemCode } from "@croco/execution-core";

// 에러 코드
ExecutionProblemCode.NOT_FOUND; // 실행을 찾을 수 없음
ExecutionProblemCode.MAX_RETRIES_EXCEEDED; // 최대 재시도 횟수 초과
ExecutionProblemCode.INVALID_STATE_TRANSITION; // 잘못된 상태 전이

// 사용 예
throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
throw ExecutionProblems.maxRetriesExceeded("Maximum retry attempts exceeded");
throw ExecutionProblems.invalidStateTransition(`Cannot transition from '${from}' to '${to}'`);
```

## 확장

### 커스텀 ExecutionStore 구현

```typescript
import type {
  CreateExecutionParams,
  Execution,
  ExecutionStatus,
  ExecutionStore,
  ListRunningExecutionsOptions,
} from "@croco/execution-core";

export class RedisExecutionStore extends ExecutionStore {
  constructor(private readonly redis: Redis) {
    super();
  }

  async create(params: CreateExecutionParams): Promise<Execution> {
    const execution: Execution = {
      id: generateId(),
      status: "pending",
      attempts: 0,
      createdAt: new Date(),
      ...params,
    };

    await this.redis.setex(
      `execution:${execution.id}`,
      86400, // 24시간 TTL
      JSON.stringify(execution),
    );

    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    const data = await this.redis.get(`execution:${id}`);
    return data ? JSON.parse(data) : null;
  }

  // Lifecycle writes must compare the persisted status atomically.
  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    // Redis transaction/Lua script using both id and expectedStatus
  }

  // Return running executions ordered by ID after the supplied cursor.
  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    // Stable keyset query
  }

  // ... 나머지 메서드 구현
}
```

## 라이선스

MIT
