# @croco/tasks-qstash

QStash에 태스크 메시지를 발행해 분산 실행을 연결하는 태스크 러너입니다.

## 설치

```bash
pnpm add @croco/tasks-qstash @upstash/qstash
```

## 사용법

```typescript
import { QStashTaskRunner } from '@croco/tasks-qstash';

const runner = new QStashTaskRunner({
  token: process.env.QSTASH_TOKEN!,
  destinationUrl: 'https://api.example.com/tasks/webhook',
  defaultDelay: 30,
});

await runner.execute('send-email', { to: 'user@example.com' });
```

## API 레퍼런스

| API | 설명 |
|---|---|
| `QStashTaskRunner` | 태스크 ID와 페이로드를 QStash로 발행합니다. |
| `QStashTaskRunnerOptions` | 토큰, 목적지 URL, 기본 지연 시간, 기본 헤더를 설정합니다. |
| `execute()` | 요청별 지연 시간과 헤더를 합쳐 메시지를 발행하고 `messageId`를 반환합니다. |

## 동작 메모

- 요청 본문은 `{ taskId, payload }` 형태로 발행됩니다.
- `options.delay`가 있으면 `defaultDelay`를 덮어씁니다.
- `options.headers`는 `defaultHeaders`와 병합됩니다.
