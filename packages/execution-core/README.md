# @croco/execution-core

실행(Execution) 상태 관리 및 추적을 위한 코어 라이브러리입니다. 모든 실행 가능한 단위(Task, Batch, Workflow)의 생명주기를 관리하는 기반을 제공합니다.

## 특징

- **표준화된 실행 모델**: `pending` → `running` → `completed` / `failed` 상태 전이 모델 제공
- **상태 전이 검증**: 허용되지 않는 상태 변화를 방지하는 엄격한 검증 로직
- **재시도 관리**: 최대 시도 횟수 기반의 자동 재시도 및 상태 관리
- **진행률 추적**: 진행률 정보 자동 계산 및 추적
- **체크포인트**: 배치 작업 재개를 위한 체크포인트 관리
- **멱등성 지원**: idempotency key를 통한 중복 실행 방지
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
import type { ExecutionStore, Execution, CreateExecutionParams, ListExecutionsOptions } from '@croco/execution-core';

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
import { ExecutionManagerImpl } from '@croco/execution-core';
import { MyDynamoExecutionStore } from './MyDynamoExecutionStore';

const store = new MyDynamoExecutionStore();
const manager = new ExecutionManagerImpl(store);

// 1. 실행 생성
const execution = await manager.create({
  type: 'my-task',
  payload: { userId: '123' },
  maxAttempts: 3,
  timeout: 30000, // 30초 타임아웃
});

// 2. 실행 시작
await manager.start(execution.id);

try {
  // ... 작업 수행 ...

  // 3. 성공 처리
  await manager.complete(execution.id, { result: 'success' });
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
  message: 'Processing items',
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
    await manager.checkpoint(execution.id, 'lastIndex', i);
  }
}

// 실패 후 재시도 시 마지막 체크포인트부터 복구
const execution = await store.findById(executionId);
const lastIndex = execution.checkpoints?.lastIndex ?? 0;
```

### 멱등성 보장

```typescript
// 같은 idempotency key로 생성 시도하면 기존 실행 반환
const first = await manager.create({
  type: 'payment',
  idempotencyKey: 'order-123-payment',
  payload: { amount: 10000 },
});

const second = await manager.create({
  type: 'payment',
  idempotencyKey: 'order-123-payment', // 동일한 key
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
  type: 'long-task',
  timeout: 60000, // 60초
});

// 타임아웃 발생시
await manager.timeout(execution.id);

// 이후 재시도 가능
await manager.retry(execution.id);
await manager.start(execution.id);
```

### 취소 처리

```typescript
// 취소 사유와 함께 실행 취소
await manager.cancel(execution.id, 'User requested cancellation');

// 취소 사유는 metadata.cancellationReason에 저장됨
const execution = await store.findById(execution.id);
console.log(execution.metadata?.cancellationReason); // 'User requested cancellation'
```

## API

### ExecutionManager

| 메서드 | 설명 |
|--------|------|
| `create(params)` | 새 실행 생성. idempotencyKey 제공 시 중복 방지 |
| `start(id)` | 실행 시작 (`running` 상태 전이). attempts 증가 |
| `complete(id, result?)` | 실행 완료 (`completed` 상태 전이) |
| `fail(id, error)` | 실행 실패. `error.retryable`과 `maxAttempts`에 따라 `failed` 또는 `retrying` 상태 전이 |
| `cancel(id, reason?)` | 실행 취소 (`cancelled` 상태 전이) |
| `retry(id)` | 재시도 상태 전이 (`retrying`). 최대 시도 횟수 초과 시 에러 |
| `updateProgress(id, progress)` | 진행률 업데이트. percent 자동 계산 |
| `checkpoint(id, key, value)` | 체크포인트 저장 |
| `timeout(id)` | 타임아웃 상태 전이 (`timed_out`) |

### 타입

```typescript
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying' | 'timed_out';

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
  parentId?: string;
  metadata?: Record<string, unknown>;
  checkpoints?: Record<string, unknown>;
  progress?: ProgressInfo;
}
```

## 에러 처리

`ExecutionProblem`을 통한 구조화된 에러 처리를 제공합니다:

```typescript
import { ExecutionProblems, ExecutionProblemCode } from '@croco/execution-core';

// 에러 코드
ExecutionProblemCode.NOT_FOUND                 // 실행을 찾을 수 없음
ExecutionProblemCode.MAX_RETRIES_EXCEEDED      // 최대 재시도 횟수 초과
ExecutionProblemCode.INVALID_STATE_TRANSITION  // 잘못된 상태 전이

// 사용 예
throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
throw ExecutionProblems.maxRetriesExceeded('Maximum retry attempts exceeded');
throw ExecutionProblems.invalidStateTransition(`Cannot transition from '${from}' to '${to}'`);
```

## 확장

### 커스텀 ExecutionStore 구현

```typescript
import type { ExecutionStore, Execution, CreateExecutionParams } from '@croco/execution-core';

export class RedisExecutionStore extends ExecutionStore {
  constructor(private readonly redis: Redis) {
    super();
  }

  async create(params: CreateExecutionParams): Promise<Execution> {
    const execution: Execution = {
      id: generateId(),
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      ...params,
    };

    await this.redis.setex(
      `execution:${execution.id}`,
      86400, // 24시간 TTL
      JSON.stringify(execution)
    );

    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    const data = await this.redis.get(`execution:${id}`);
    return data ? JSON.parse(data) : null;
  }

  // ... 나머지 메서드 구현
}
```

## 라이선스

MIT
