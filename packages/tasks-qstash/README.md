# @croco/tasks-qstash

Upstash QStash 기반 분산 태스크 큐 구현체입니다. 신뢰할 수 있는 태스크 전달을 위해 QStash를 활용합니다.

## 설치

```bash
pnpm add @croco/tasks-qstash
```

## 사용 방법

### QStashTaskRunner 초기화

```typescript
import { QStashTaskRunner } from '@croco/tasks-qstash';

const runner = new QStashTaskRunner({
  token: process.env.QSTASH_TOKEN!,
  destinationUrl: 'https://api.example.com/tasks/webhook',
  defaultDelay: 30,
});
```

### 태스크 실행

```typescript
// 기본 실행
await runner.execute('send-email', {
  to: 'user@example.com',
  subject: 'Welcome',
});

// 지연 실행
await runner.execute('process-image', { url: 'https://...' }, {
  delay: 60,
});

// 커스텀 헤더
await runner.execute('generate-report', { id: 123 }, {
  headers: {
    'X-Request-ID': 'abc-123',
  },
});
```

## API Reference

### QStashTaskRunnerOptions

| 속성 | 타입 | 필수 | 설명 |
|------|------|------|------|
| token | string | ✓ | QStash 인증 토큰 |
| destinationUrl | string | ✓ | 태스크 웹훅 수신 URL |
| defaultDelay | number | ✗ | 기본 지연 시간 (초) |
| defaultHeaders | Record\<string, string\> | ✗ | 기본 요청 헤더 |

### QStashTaskRunner.execute()

```typescript
async execute(
  taskId: string,
  payload: unknown,
  options?: {
    delay?: number;
    headers?: Record<string, string>;
  }
): Promise<{ messageId: string }>
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| taskId | string | 실행할 태스크 ID |
| payload | unknown | 태스크 핸들러에 전달할 페이로드 |
| options.delay | number | 전달 지연 시간 (초) |
| options.headers | Record\<string, string\> | 추가 요청 헤더 |

**반환값:** QStash 메시지 ID

## 작동 방식

1. `execute()`가 호출되면 QStash에 메시지를 발행합니다.
2. QStash가 구성된 `destinationUrl`로 HTTP POST 요청을 보냅니다.
3. 요청 본문: `{ taskId, payload }`
4. 수신 서버에서 이 웹훅을 처리하고 `TaskRunner.execute()`를 호출합니다.

## 환경 변수

```bash
QSTASH_TOKEN="your-qstash-token"
```