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

const completed = await store.updateIfStatus(execution.id, "running", {
  status: "completed",
  completedAt: new Date(),
});

if (!completed) {
  // 다른 worker가 먼저 terminal 상태를 커밋했습니다.
}

const pending = await store.list({ status: "pending", limit: 20 });
const runningBatch = await store.listRunning({ afterId: undefined, limit: 100 });
```

## API 레퍼런스

### `DrizzleExecutionStore`

- `create(params)`, 실행을 생성하고 idempotencyKey 중복을 막습니다.
- `findById(id)`, 실행 ID로 조회합니다.
- `findByIdempotencyKey(key)`, 중복 키로 기존 실행을 조회합니다.
- `update(id, data)`, 상태, 결과, 오류, 리플레이 연결, 로그, 진행률을 갱신합니다.
- `updateIfStatus(id, expectedStatus, data)`, ID와 예상 상태가 모두 일치할 때만 원자적으로 갱신하며 경쟁에서 지면 `null`을 반환합니다.
- `listRunning(options)`, 실행 중인 레코드를 ID 오름차순의 안정적인 키셋으로 조회합니다.
- `appendLog(id, entry)`, 실행 로그를 원자적으로 추가합니다.
- `acquireContinuation(id, input)`, 전달 토큰을 검증하고 continuation lease를 compare-and-set으로 획득합니다.
- `updateClaimedContinuation(id, input)`, fencing token이 유효한 claim만 갱신합니다.
- `list(options)`, 상태, 타입, 부모 실행, 리플레이 원본 기준으로 목록을 조회합니다.
- `delete(id)`, 실행을 삭제합니다.

### `executions`

실행 영속화에 사용하는 PostgreSQL 스키마입니다. `idempotency_key`, `parent_id`, `replay_of`, `status`, `type` 인덱스를 포함합니다.

`continuation`은 nullable JSONB 컬럼이고, `request_fingerprint`는 nullable `varchar(64)` 컬럼입니다. 이 버전을
배포하기 전에 애플리케이션이 사용하는 migration 도구로 다음 컬럼을 먼저 추가해야 합니다.

```sql
ALTER TABLE executions ADD COLUMN IF NOT EXISTS continuation jsonb;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64);
```

스키마 migration보다 새 애플리케이션 코드를 먼저 배포하면 execution 쿼리가 실패합니다. migration 완료 후 기존
task writer를 모두 drain하고 새 버전을 배포하세요. 구버전 writer와 새 버전 writer가 동시에 실행되면 legacy key 조회와
scoped key 생성 사이에 두 실행이 만들어질 수 있으므로 혼합 버전 배포는 지원하지 않습니다.

### 타입

- `ExecutionRow`, 조회 결과 행 타입입니다.
- `NewExecutionRow`, 삽입 입력 행 타입입니다.
