# @croco/batch-qstash

QStash 기반 비동기 배치 처리 실행기입니다. 대용량 데이터를 청크 단위로 처리하며, 체크포인트와 멱등성을 통해 안정적인 재시작을 지원합니다.

## 특징

- **비동기 청크 처리**: QStash 메시지 큐를 통해 청크 단위로 트리거
- **체크포인트 기반 재시작**: 실패 시 마지막 체크포인트부터 재개 가능
- **멱등성 보장**: Idempotency-Key를 통해 중복 처리 방지
- **Read-ahead 지원**: 청크 경계에서 아이템 유실 방지

## 설치

```bash
pnpm add @croco/batch-qstash
```

## 사용 방법

```typescript
import { QStashChunkExecutor } from '@croco/batch-qstash';
import { Client } from '@upstash/qstash';

const executor = new QStashChunkExecutor(executionManager, {
  qstashClient: new Client({ token: process.env.QSTASH_TOKEN! }),
  webhookUrl: 'https://your-api.com/batch/webhook',
});

const result = await executor.executeChunk(executionId, step);
// → { hasMore: boolean, processedCount: number }
```

## API Reference

### QStashChunkExecutor

```typescript
new QStashChunkExecutor(
  executionManager: ExecutionManager,
  options: QStashExecutorOptions
)
```

#### Options

| Property | Type | Description |
|----------|------|-------------|
| `qstashClient` | `Client` | Upstash QStash 클라이언트 |
| `webhookUrl` | `string` | 다음 청크 트리거용 Webhook URL |

#### Methods

**executeChunk<I, O>(executionId: string, step: Step<I, O>)**

청크 단위로 데이터를 처리하고 결과를 반환합니다.

## 체크포인트 지원

Reader가 `Checkpointable` 인터페이스를 구현하면 실패 시 재시작 가능합니다.

```typescript
class DatabaseReader implements ItemReader<User>, Checkpointable {
  private cursor = 0;

  async read(): Promise<User | null> {
    const users = await db.users.find({ skip: this.cursor, limit: 1 });
    if (users.length === 0) return null;
    this.cursor++;
    return users[0];
  }

  getCheckpoint(): number {
    return this.cursor;
  }

  restoreCheckpoint(checkpoint: number): void {
    this.cursor = checkpoint;
  }
}
```

## 아키텍처

```
Reader → Chunk → Writer → Storage
              ↓           ↓
          Process    hasMore? → QStash
```

## 의존성

- `@croco/batch-core`: 배치 처리 인터페이스
- `@croco/execution-core`: 실행 상태 관리
- `@upstash/qstash`: QStash 클라이언트