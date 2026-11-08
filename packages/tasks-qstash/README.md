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
  token: process.env.UPSTASH_QSTASH_TOKEN!,
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

## Canonical module plugin

`qstashTasks()`는 `TASK_DISPATCHER_TOKEN`을 소유하는 실행 가능한 application plugin을 반환합니다.
metadata에는 QStash 구성 요구사항, runtime 호환성, maturity와 검증 명령이 포함됩니다.

```typescript
import { qstashTasks } from "@croco/tasks-qstash";

const tasks = qstashTasks({
  token: process.env.UPSTASH_QSTASH_TOKEN!,
  destinationUrl: process.env.UPSTASH_QSTASH_DESTINATION_URL!,
});
```

## 동작 메모

- 요청 본문은 `{ taskId, payload }` 형태로 발행됩니다.
- `options.delay`가 있으면 `defaultDelay`를 덮어씁니다.
- `options.headers`는 `defaultHeaders`와 병합됩니다.
- `options.idempotencyKey`가 있으면 `[1, destinationUrl, taskId, idempotencyKey]`의 JSON 문자열을
  UTF-8로 인코딩해 SHA-256으로 해시하고 `croco-task-v1:<64자리 소문자 hex>`를 QStash
  `deduplicationId`로 전달합니다. SDK는 이를 `Upstash-Deduplication-Id` publish header로 설정합니다.
  ID는 입력 길이와 관계없이 78 ASCII byte이며 구분자가 포함된 입력도 서로 구분합니다.
  목적지 URL은 설정한 문자열 그대로 사용하고 task reference는 이름으로 식별합니다.
- 같은 목적지·task·key의 재발행은 runner를 새로 만들어도 같은 ID를 사용합니다. 다른 목적지나 task는
  같은 업무 key를 써도 별도 메시지로 발행됩니다. key를 생략하면 deduplication ID를 설정하지 않습니다.
- payload, delay, headers는 ID에 포함하지 않습니다. 같은 key로 내용을 바꿔 보내도
  [QStash의 10분 deduplication window](https://upstash.com/docs/qstash/features/deduplication) 안에서는
  이미 수락한 메시지를 반환하므로 새 작업에는 새 key를 사용해야 합니다. 응답을 받지 못한 발행의
  재시도에도 같은 ID를 사용합니다. 이 범위를 넘는 업무 멱등성은 수신자가 보장해야 합니다.
- **ID 전환:** 이전 버전은 caller key를 그대로 전송했습니다. 이전 ID와 새 해시 ID 사이에는 중복 제거가
  적용되지 않으므로 혼용 배포, 업그레이드 직전 메시지 재전송, 이전 버전으로 rollback할 때 같은 작업이
  다시 enqueue될 수 있습니다. 수신자에서 업무 key를 검증하고, 전환 중인 발행을 정지할 수 있다면
  마지막 이전 ID 발행 후 최소 10분이 지난 뒤 재개하세요. 원래 caller key는 본문에 자동으로 추가되지
  않으므로 수신자에게 필요한 업무 식별자는 payload에 명시해야 합니다.
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
