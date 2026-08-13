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

### 타입과 스키마

- `DrizzleOnboardingClient`, 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
- `OnboardingStateRow`, 온보딩 상태 행 타입입니다.
- `DRIZZLE_TOKEN`, 온보딩 저장소용 DB 토큰입니다.
- `onboardingStates`, 온보딩 상태 스키마입니다.
