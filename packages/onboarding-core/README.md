# @croco/onboarding-core

사용자/팀 온보딩 플로우 관리를 위한 핵심 패키지입니다.

## 개요

`onboarding-core`는 온보딩 워크플로우를 정의하고 상태를 관리하는 추상화 레이어를 제공합니다. 이 패키지는 온보딩 단계 정의, 상태 추적, 완료 여부 계산 등의 핵심 로직을 포함합니다.

## 설치

```bash
pnpm add @croco/onboarding-core
```

## 사용법

### OnboardingManager

온보딩 플로우의 orchestration을 담당합니다.

```typescript
import { OnboardingManager } from "@croco/onboarding-core";

const manager = new OnboardingManager(store, analytics);

// 온보딩 정의 등록
manager.register({
  id: "welcome-tour",
  steps: [
    { id: "step-1", title: "Welcome", required: true },
    { id: "step-2", title: "Setup Profile", required: true },
    { id: "step-3", title: "Optional Tour", required: false },
  ],
});

// 온보딩 상태 조회
const status = await manager.getStatus("welcome-tour");

// 단계 완료
await manager.completeStep("welcome-tour", "step-1");
```

### OnboardingStore

온보딩 상태 저장소의 추상 클래스입니다. 커스텀 구현체를 만들거나 `InMemoryOnboardingStore`를 사용할 수 있습니다.

```typescript
import { OnboardingStore, InMemoryOnboardingStore } from "@croco/onboarding-core";

// 인메모리 저장소 (테스트용)
const store = new InMemoryOnboardingStore();

// 커스텀 구현
class MyOnboardingStore extends OnboardingStore {
  async getState(
    tenantId: string,
    userId: string,
    onboardingId: string,
  ): Promise<OnboardingState | null> {
    // 구현
  }

  async saveState(
    tenantId: string,
    userId: string,
    onboardingId: string,
    state: OnboardingState,
  ): Promise<void> {
    // 구현
  }
}
```

## API

### OnboardingManager

#### Constructor

```typescript
constructor(
  store: OnboardingStore,
  analytics: AnalyticsManager
)
```

#### Methods

- `register(definition: OnboardingDefinition): void` - 온보딩 정의 등록
- `getStatus(onboardingId: string): Promise<OnboardingState>` - 온보딩 상태 조회
- `completeStep(onboardingId: string, stepId: string): Promise<void>` - 단계 완료 처리

### 타입

```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  type?: OnboardingStepType;
  order?: number;
  featureFlagKey?: string;
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
}

interface OnboardingState {
  steps: Record<string, StepState>;
  isCompleted: boolean;
  completedAt?: Date;
  status?: OnboardingStatus;
  startedAt?: Date;
  currentStepId?: string;
}

interface StepState {
  completed: boolean;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";
type OnboardingStepType = "required" | "optional" | "conditional";

interface OnboardingDefinition {
  id: string;
  steps: OnboardingStep[];
  metadata?: Record<string, unknown>;
}

interface OnboardingContext {
  tenantId: string;
  userId: string;
  onboardingId: string;
}
```

### Error Types

- `OnboardingDefinitionNotFoundProblem` - 정의를 찾을 수 없을 때
- `OnboardingStepNotFoundProblem` - 단계를 찾을 수 없을 때
- `OnboardingContextRequiredProblem` - 컨텍스트가 필요할 때

## Context 요구사항

`OnboardingManager`는 `@croco/framework-context`의 `Context`를 통해 tenantId와 userId를 가져옵니다.

```typescript
import { Context } from "@croco/framework-context";

await Context.run(
  { requestId: "req-1", user: { id: "user-1" }, tenantId: "tenant-1" },
  async () => {
    await manager.completeStep("welcome-tour", "step-1");
  },
);
```

## Drizzle 구현체

데이터베이스 저장소가 필요한 경우 `@croco/onboarding-drizzle` 패키지를 사용하세요.

```bash
pnpm add @croco/onboarding-drizzle
```

```typescript
import { DrizzleOnboardingStore } from "@croco/onboarding-drizzle";

const store = new DrizzleOnboardingStore(db, txManager);
const manager = new OnboardingManager(store, analytics);
```

## 테스트

```bash
pnpm test --filter=@croco/onboarding-core
```

## 라이선스

MIT
