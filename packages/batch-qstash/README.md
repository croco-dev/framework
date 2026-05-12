# @croco/batch-qstash

배치 Step을 청크 단위로 실행하고 다음 청크를 QStash로 예약하는 실행기입니다.

## 설치

```bash
pnpm add @croco/batch-qstash @upstash/qstash
```

## 사용법

```typescript
import { Client } from "@upstash/qstash";
import { QStashChunkExecutor } from "@croco/batch-qstash";

const executor = new QStashChunkExecutor(executionManager, {
  qstashClient: new Client({ token: process.env.QSTASH_TOKEN! }),
  webhookUrl: "https://api.example.com/batch/next",
});

const result = await executor.executeChunk("execution-1", step);
```

## API 레퍼런스

| API                     | 설명                                                     |
| ----------------------- | -------------------------------------------------------- |
| `QStashChunkExecutor`   | 청크 실행, 체크포인트 저장, 다음 청크 예약을 수행합니다. |
| `QStashExecutorOptions` | `qstashClient`, `webhookUrl`을 받는 옵션 타입입니다.     |

## 동작 메모

- 체크포인트 가능한 reader면 마지막 위치를 저장하고 복구합니다.
- peek 지원 reader면 다음 아이템 존재 여부를 비소모 방식으로 확인합니다.
- 다음 청크 메시지는 step 이름과 checkpoint 기준 idempotency key를 붙여 발행합니다.
