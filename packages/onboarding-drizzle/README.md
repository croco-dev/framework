# @croco/onboarding-drizzle

`@croco/onboarding-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/onboarding-drizzle @croco/onboarding-core drizzle-orm
```

## 사용법

```typescript
import { DrizzleOnboardingStore } from "@croco/onboarding-drizzle";
import { TxManager } from "@croco/tx-core";

const txManager = new TxManager(adapter, { defaultNesting: "join" });
const store = new DrizzleOnboardingStore(db, txManager);

await store.saveState("tenant-1", "user-1", "welcome-tour", {
  steps: {
    welcome: { completed: true, completedAt: new Date() },
    profile: { completed: false },
  },
  isCompleted: false,
});

const state = await store.getState("tenant-1", "user-1", "welcome-tour");
```

## API 레퍼런스

### `DrizzleOnboardingStore`

- `getState(tenantId, userId, onboardingId)`, 저장된 온보딩 상태를 조회합니다.
- `saveState(tenantId, userId, onboardingId, state)`, 상태를 upsert로 저장합니다.
- `completeStep(tenantId, userId, onboardingId, input)`, 단일 upsert 문장에서 현재 저장 상태를 기준으로 단계와
  전체 완료 전이를 원자적으로 적용합니다. PostgreSQL 트랜잭션 오류는 트랜잭션 소유자에게 그대로 전달됩니다.
- 기존 데이터베이스는 `addCompletionStepIdentity(db)` migration을 적용해 완료 전이를 일으킨 단계 식별자를
  저장해야 합니다.
- 기존 데이터베이스는 `addOnboardingLifecycleFields(db)` migration을 적용해 lifecycle 필드를 nullable 컬럼으로
  추가해야 합니다. 기존 행은 알 수 없는 상태를 그대로 나타내도록 세 필드를 `NULL`로 유지합니다.

### 타입과 스키마

- `DrizzleOnboardingClient`, 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
- `OnboardingStateRow`, 온보딩 상태 행 타입입니다.
- `DRIZZLE_TOKEN`, 온보딩 저장소용 DB 토큰입니다.
- `onboardingStates`, 온보딩 상태 스키마입니다.
- `addOnboardingLifecycleFields`, 기존 테이블에 nullable lifecycle 필드를 추가하는 migration입니다.

## 목표형 온보딩 저장소

```typescript no-check
import { addOnboardingGoals, DrizzleGoalStore } from "@croco/onboarding-drizzle";

await addOnboardingGoals(db);
const goalStore = new DrizzleGoalStore(db, txManager);
```

`addOnboardingGoals`는 목표 정의 이력, episode, action receipt 테이블을 만듭니다. 먼저 `@croco/events-tx`의
`transactionalOutboxMessages` 스키마에 해당하는 `croco_outbox_messages` 테이블을 준비해야 합니다. 목표 달성
전이는 episode 갱신과 outbox append를 같은 `TxManager` 트랜잭션에 저장합니다. 발행은
`TransactionalOutboxRelay`로 수행하며, 소비자는 event ID로 중복 전송을 처리해야 합니다.

게시한 정의의 revision, actor, reason, idempotency key와 각 episode의 version, timezone, threshold,
allowed lateness는 저장됩니다. 같은 idempotency key의 동일 게시 요청은 기존 게시 결과를 반환합니다.
receipt의 event ID는 episode 안에서 고유하며, 원본 object ID와 confirmation evidence ID는 저장하지 않습니다.
`removeOnboardingGoals`는 목표 테이블을 삭제하는 rollback migration이므로 보존할 데이터가 없을 때만 사용합니다.
