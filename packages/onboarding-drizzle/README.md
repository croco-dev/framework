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

### 타입과 스키마

- `DrizzleOnboardingClient`, 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
- `OnboardingStateRow`, 온보딩 상태 행 타입입니다.
- `DRIZZLE_TOKEN`, 온보딩 저장소용 DB 토큰입니다.
- `onboardingStates`, 온보딩 상태 스키마입니다.
