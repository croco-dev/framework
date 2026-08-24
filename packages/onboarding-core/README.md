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
import {
  createOnboardingStoreConformanceSuite,
  InMemoryOnboardingStore,
  OnboardingStore,
} from "@croco/onboarding-core";

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

  async completeStep(
    tenantId: string,
    userId: string,
    onboardingId: string,
    input: CompleteOnboardingStepInput,
  ): Promise<CompleteOnboardingStepResult> {
    // 단계 상태와 전체 완료 전이를 원자적으로 적용
  }
}
```

커스텀 저장소는 동일한 lifecycle-field 계약을 검증하는 conformance suite를 실행할 수 있습니다.

```typescript
import { it } from "vitest";

const suite = createOnboardingStoreConformanceSuite({ createStore: () => new MyOnboardingStore() });

for (const testCase of suite.cases) {
  it(testCase.name, testCase.run);
}
```

`InMemoryOnboardingStore`는 저장 입력과 조회·완료 결과를 각각 독립적인 스냅샷으로 보관합니다.
`StepState.metadata`는 primitive, 배열, plain record, `Date`, 비공유 `ArrayBuffer`와 그 view만 포함할 수
있습니다. 함수, accessor, symbol 또는 non-enumerable own property, 지원 내장 타입에 덧붙인 own
property, 사용자 정의 인스턴스, `SharedArrayBuffer`와 공유 메모리 view는 독립적인 스냅샷을 보장할
수 없으므로 `OnboardingStateSnapshotUnsupportedProblem`으로 거부됩니다.

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

- `register(definition: OnboardingDefinition): void` - 온보딩 정의 등록. 같은 ID를 다시 등록하면
  `DuplicateOnboardingDefinitionProblem`으로 실패하며 기존 정의를 유지합니다.
- `getStatus(onboardingId: string): Promise<OnboardingState>` - 온보딩 상태 조회
- `completeStep(onboardingId: string, stepId: string): Promise<void>` - 단계 완료 처리

#### `completeStep()` 저장 및 분석 이벤트 계약

`completeStep()`는 컨텍스트, 온보딩 정의, 단계 존재 여부를 먼저 검증한 뒤
`OnboardingStore.completeStep()`로 단계 상태와 전체 완료 전이를 원자적으로 적용합니다.

- 서로 다른 단계의 동시 완료는 한 상태에 모두 보존되며 전체 완료 전이는 한 번만 적용됩니다.
- 동일한 단계의 반복 완료는 저장과 분석 이벤트를 반복하지 않습니다.
- 저장소가 `conflict`를 반환하면 최대 3회 시도하고, 모두 충돌하면
  `OnboardingStepCompletionConflictProblem`으로 명시적으로 실패합니다.
- 원자적 저장 성공 후 `onboarding_completed`와 `onboarding_step_completed` 이벤트를 best-effort로 전송합니다.
- 분석 이벤트 전송이 동기적으로 실패해도 저장된 온보딩 상태는 유지되고 `completeStep()`는 성공으로 처리됩니다.

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

- `DuplicateOnboardingDefinitionProblem` - 이미 등록된 정의 ID를 다시 등록할 때
- `OnboardingDefinitionNotFoundProblem` - 정의를 찾을 수 없을 때
- `OnboardingStepNotFoundProblem` - 단계를 찾을 수 없을 때
- `OnboardingContextRequiredProblem` - 컨텍스트가 필요할 때
- `OnboardingStateSnapshotUnsupportedProblem` - 인메모리 상태 메타데이터가 독립적으로 복사될 수 없거나 공유 메모리를 포함할 때

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
