# @croco/onboarding-drizzle

@croco/onboarding-core의 Drizzle ORM 기반 구현체입니다.

## 개요

`onboarding-drizzle`은 사용자/팀 온보딩 상태를 Drizzle ORM으로 관리하는 저장소 구현체를 제공합니다.

## 설치

```bash
pnpm add @croco/onboarding-drizzle @croco/onboarding-core drizzle-orm
```

## 데이터베이스 스키마

```sql
CREATE TABLE onboarding_states (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  onboarding_id TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (tenant_id, user_id, onboarding_id)
);

CREATE INDEX idx_onboarding_states_tenant_id ON onboarding_states(tenant_id);
CREATE INDEX idx_onboarding_states_user_id ON onboarding_states(user_id);
CREATE INDEX idx_onboarding_states_onboarding_id ON onboarding_states(onboarding_id);
```

## 사용법

### DrizzleOnboardingStore

```typescript
import { DrizzleOnboardingStore, DRIZZLE_TOKEN } from '@croco/onboarding-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

const store = new DrizzleOnboardingStore(db, txManager);

// 온보딩 상태 저장
await store.saveState('tenant-1', 'user-1', 'welcome-tour', {
  steps: {
    'step-1': { completed: true, completedAt: new Date() },
    'step-2': { completed: false },
  },
  isCompleted: false,
});

// 온보딩 상태 조회
const state = await store.getState('tenant-1', 'user-1', 'welcome-tour');
```

### DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject } from '@croco/framework-context';
import { OnboardingManager, OnboardingStore } from '@croco/onboarding-core';
import { DrizzleOnboardingStore, DRIZZLE_TOKEN } from '@croco/onboarding-drizzle';

const DRIZZLE_DB_TOKEN = 'DRIZZLE_DB_TOKEN';
const TX_MANAGER_TOKEN = 'TX_MANAGER_TOKEN';

Container.set(OnboardingStore.token, {
  factory: () => {
    const db = Container.get(DRIZZLE_DB_TOKEN);
    const txManager = Container.get(TX_MANAGER_TOKEN);
    return new DrizzleOnboardingStore(db, txManager);
  },
});

@Component()
class UserService {
  constructor(
    @Inject(OnboardingManager) private onboardingManager: OnboardingManager
  ) {}

  async completeWelcomeStep(userId: string) {
    this.onboardingManager.register({
      id: 'welcome-tour',
      steps: [
        { id: 'step-1', title: 'Welcome', required: true },
        { id: 'step-2', title: 'Setup Profile', required: true },
      ],
    });

    await this.onboardingManager.completeStep('welcome-tour', 'step-1');
  }
}
```

## API

### DrizzleOnboardingStore

`OnboardingStore` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(
  db: DrizzleOnboardingClient,
  txManager: TxManager<DrizzleOnboardingClient>
)
```

#### Methods

- `getState(tenantId: string, userId: string, onboardingId: string): Promise<OnboardingState | null>` - 온보딩 상태 조회
- `saveState(tenantId: string, userId: string, onboardingId: string, state: OnboardingState): Promise<void>` - 온보딩 상태 저장 (upsert 지원)

### Schema

- `onboardingStates` - 온보딩 상태 테이블

## 타입

```typescript
type OnboardingState = {
  steps: Record<string, StepState>;
  isCompleted: boolean;
  completedAt?: Date;
  status?: OnboardingStatus;
  startedAt?: Date;
  currentStepId?: string;
};

type StepState = {
  completed: boolean;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
};

type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
```

## 트랜잭션 지원

`DrizzleOnboardingStore`는 `@croco/tx-core`의 트랜잭션 매니저와 통합되어 있습니다. 활성 트랜잭션 컨텍스트가 있으면 자동으로 참여합니다.

```typescript
import { Transactional } from '@croco/tx-core';

class MyService {
  @Transactional()
  async setupUserOnboarding(userId: string, tenantId: string) {
    // 같은 트랜잭션 내에서 실행
    await userStore.create({ id: userId, tenantId });
    await onboardingStore.saveState(tenantId, userId, 'setup', {
      steps: {},
      isCompleted: false,
    });
  }
}
```

## 테스트

```bash
pnpm test --filter=@croco/onboarding-drizzle
```

## 라이선스

MIT
