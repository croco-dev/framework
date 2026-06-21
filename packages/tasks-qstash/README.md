# @croco/tasks-qstash

QStash에 태스크 메시지를 발행해 분산 실행을 연결하는 태스크 러너입니다.

## 설치

```bash
pnpm add @croco/tasks-qstash @upstash/qstash
```

## 사용법

```typescript
import { QStashTaskRunner } from "@croco/tasks-qstash";

const runner = new QStashTaskRunner({
  token: process.env.QSTASH_TOKEN!,
  destinationUrl: "https://api.example.com/tasks/webhook",
  defaultDelay: 30,
});

await runner.execute("send-email", { to: "user@example.com" });
await runner.execute(
  "sync-customer",
  { customerId: "cus_123" },
  { idempotencyKey: "sync-customer:cus_123" },
);
```

## API 레퍼런스

| API                           | 설명                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `QStashTaskRunner`            | 태스크 ID와 페이로드를 QStash로 발행합니다.                                                 |
| `QStashTaskRunnerOptions`     | 토큰, 목적지 URL, 기본 지연 시간, 기본 헤더를 설정합니다.                                   |
| `QStashTaskExecuteOptions`    | 요청별 `delay`, `headers`, `idempotencyKey`를 설정합니다.                                   |
| `execute()`                   | 요청별 지연 시간, 헤더, deduplication id를 합쳐 메시지를 발행하고 `messageId`를 반환합니다. |
| `QStashTaskConfigProblem`     | 필수 token/destination URL 누락을 나타내는 terminal Problem입니다.                          |
| `QStashTaskValidationProblem` | invalid task id, URL, delay, idempotency key를 나타내는 terminal Problem입니다.             |
| `QStashTaskPublishProblem`    | QStash publish 오류를 redaction과 retryable evidence로 정규화합니다.                        |

## 동작 메모

- 요청 본문은 `{ taskId, payload }` 형태로 발행됩니다.
- `options.delay`가 있으면 `defaultDelay`를 덮어씁니다.
- `options.headers`는 `defaultHeaders`와 병합됩니다. `options.idempotencyKey`가 있으면 QStash
  `deduplicationId`로 전달되어 SDK가 `Upstash-Deduplication-Id` publish header를 설정합니다.
- QStash upstream 오류는 `QStashTaskPublishProblem`으로 변환되며 `retryable` 확장 필드로 일시 장애와
  terminal 오류를 구분합니다. 토큰, secret, credential 형태의 값은 Problem detail에서 redaction됩니다.

## Conformance

`@croco/testing`의 `createQStashTaskConformanceSuite()`를 패키지 테스트에서 실행합니다. 기본 테스트는
mocked QStash client만 사용하므로 QStash credential이 없어도 통과해야 합니다.

현재 conformance coverage:

- 필수 QStash token 누락 Problem
- task envelope, delay, custom header, QStash deduplication id
- invalid task id와 unsupported delay
- retryable upstream failure와 terminal upstream failure 구분
- live smoke env gate skip

선택적 live smoke는 별도 opt-in env gate(`CROCO_LIVE_QSTASH`, `UPSTASH_QSTASH_TOKEN`,
`UPSTASH_QSTASH_DESTINATION_URL`) 뒤에 두며 실제 QStash backend publish를 실행할 수 있습니다.
webhook/schedule verification과 diagnostics/readiness provider는 아직 beta/production promotion blocker입니다.

---

## 성숙도 안내

| 항목                 | 상태                                                         | 설명                                                                     |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **현재 상태**        | 🔴 alpha                                                     | 개발 중, 사용 시 주의 필요                                               |
| **주요 기능**        | 태스크 메시지 발행, 지연 설정, 커스텀 헤더, deduplication id | QStash 기본 연동과 publish 중복 방지 evidence                            |
| **테스트 존재 여부** | ✅                                                           | 단위테스트 1개 파일 (`QStashTaskRunner.spec.ts`)와 shared conformance    |
| **운영 증거 수준**   | L1                                                           | default no-credential conformance 있음 / live smoke와 diagnostics 미존재 |

### 참고

- `@croco/tasks-core` 추상화를 구현합니다.
- 요청 본문은 `{ taskId, payload }` 형태로 발행됩니다.
- 지연 시간과 헤더를 요청별로 커스터마이징할 수 있습니다.
