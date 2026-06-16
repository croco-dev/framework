# @croco/execution-drizzle

`@croco/execution-core`용 Drizzle 실행 저장소입니다.

## 설치

```bash
pnpm add @croco/execution-drizzle @croco/execution-core drizzle-orm ulid
```

## 사용법

```typescript
import { DrizzleExecutionStore } from "@croco/execution-drizzle";

const store = new DrizzleExecutionStore(db);

const execution = await store.create({
  type: "task",
  payload: { job: "email-send" },
  maxAttempts: 3,
  idempotencyKey: "email:tenant-1:user-1",
});

await store.update(execution.id, {
  status: "running",
  attempts: 1,
  startedAt: new Date(),
  logs: [
    {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Execution started",
    },
  ],
});

const pending = await store.list({ status: "pending", limit: 20 });
```

## API 레퍼런스

### `DrizzleExecutionStore`

- `create(params)`, 실행을 생성하고 idempotencyKey 중복을 막습니다.
- `findById(id)`, 실행 ID로 조회합니다.
- `findByIdempotencyKey(key)`, 중복 키로 기존 실행을 조회합니다.
- `update(id, data)`, 상태, 결과, 오류, 리플레이 연결, 로그, 진행률을 갱신합니다.
- `appendLog(id, entry)`, 실행 로그를 원자적으로 추가합니다.
- `list(options)`, 상태, 타입, 부모 실행, 리플레이 원본 기준으로 목록을 조회합니다.
- `delete(id)`, 실행을 삭제합니다.

### `executions`

실행 영속화에 사용하는 PostgreSQL 스키마입니다. `idempotency_key`, `parent_id`, `replay_of`, `status`, `type` 인덱스를 포함합니다.

### 타입

- `ExecutionRow`, 조회 결과 행 타입입니다.
- `NewExecutionRow`, 삽입 입력 행 타입입니다.
