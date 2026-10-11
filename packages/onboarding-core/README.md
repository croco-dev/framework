# @croco/onboarding-core

사용자/팀 온보딩 플로우 관리를 위한 핵심 패키지입니다.

## 개요

`onboarding-core`는 온보딩 워크플로우를 정의하고 상태를 관리하는 추상화 레이어를 제공합니다. 이 패키지는 온보딩 단계 정의, 상태 추적, 완료 여부 계산 등의 핵심 로직을 포함합니다.

## 설치

```bash
pnpm add @croco/onboarding-core
```

## 사용법

### 서버가 확인한 행동으로 목표 진행하기

`GoalManager`는 기존 checklist와 별도로 동작합니다. 게시할 정의에는 `anchor`, `actionId`,
`windowMs`, `allowedLatenessMs`, `timezone`, `countMode`, `threshold`, `deletedObjectPolicy`를
명시합니다. `events`는 서로 다른 event ID, `distinct_objects`는 서로 다른 도메인 object ID,
`distinct_calendar_days`는 episode에 고정된 시간대의 서로 다른 날짜를 셉니다.

```typescript
import { GoalManager, InMemoryGoalStore } from "@croco/onboarding-core";

const goals = new GoalManager(
  new InMemoryGoalStore(),
  receiptVerifier, // 서버의 실제 도메인 저장 결과와 receipt를 대조
  publicationAuthorizer, // actor의 정의 게시 권한을 확인
  subjectVerifier, // tenant/app/environment 안의 subject를 확인
);

await goals.publishDefinition({
  scope: { tenantId: "tenant-1", appId: "app-1", environmentId: "production" },
  definition: {
    id: "first-report",
    version: "v1",
    anchor: "signup",
    actionId: "report.saved",
    windowMs: 7 * 86_400_000,
    allowedLatenessMs: 86_400_000,
    timezone: "Asia/Seoul",
    countMode: "events",
    threshold: 1,
    deletedObjectPolicy: "retract",
    nextActionHref: "/reports/new",
  },
  revision: 1,
  actorId: "operator-1",
  reason: "Show the first report goal",
  idempotencyKey: "first-report-v1",
  publishedAt: new Date(),
});

await goals.beginEpisode({
  id: "signup-1",
  scope,
  subject,
  definitionId: "first-report",
  anchor: "signup",
  startedAt: signupTime,
});

await goals.observeAction({
  scope,
  subject,
  episodeId: "signup-1",
  receivedAt: new Date(),
  receipt: {
    eventId: "report-saved-1",
    actionId: "report.saved",
    objectId: "report-1",
    occurredAt: reportSavedAt,
    confirmation: { source: "server", evidenceId: "report-transaction-1" },
  },
});

const progress = await goals.getProgress({
  scope,
  subject,
  episodeId: "signup-1",
  asOf: new Date(),
});
```

`scope`, `subject`, `signupTime`, `reportSavedAt`와 세 검증기는 호스트가 제공해야 합니다.
`subject`는 `{ id, verified: true }` 형태이며, 이 표시만 신뢰하지 말고 `subjectVerifier`에서
서버 권한을 확인합니다. `receiptVerifier`는 클라이언트가 보낸 성공 주장만으로 완료되지 않도록
실제 저장 결과를 검증합니다. 인메모리 저장소는 테스트용입니다. 운영 저장소는
`@croco/onboarding-drizzle`의 `DrizzleGoalStore(db, txManager)`와 migration을 사용하고,
도메인 저장과 `observeAction()`을 같은 `TxManager` 트랜잭션에서 실행합니다. 달성 intent는
기존 transactional outbox에 기록되므로 별도의 relay/worker가 이를 발행해야 합니다.
실행 가능한 PostgreSQL·브라우저 예제는 `examples/onboarding-goals`에 있습니다.

행동 시각은 `[startedAt, endsAt)` 안에 있어야 합니다. `endsAt`부터
`endsAt + allowedLatenessMs` 전까지는 `closing`이고, 그 시점부터 `expired`입니다.
기한 이후 도착한 증거는 보존하되 진행도나 달성을 재개하지 않습니다. 정의의 version,
시간대, threshold, 기한은 episode 시작 시 고정됩니다. `delete_object` 정정은 정의의
`deletedObjectPolicy`가 `retract`일 때 해당 object의 행동을 제외하며, 저장소는 원문 object ID
대신 digest만 보관합니다.

목표 달성으로 기존 checklist 단계를 완료하려면 `OnboardingManager.registerGoalStepBridge()`로
scope·goal definition ID·onboarding ID·step ID를 명시적으로 연결한 뒤, outbox consumer에서
`handleGoalAchieved()`를 호출합니다. `GoalManager`만 사용하면 checklist를 만들거나 완료하지
않습니다. 기존 `completeStep()`의 수동 완료 계약은 그대로 유지됩니다.

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
  `DuplicateOnboardingDefinitionProblem`으로 실패하며 기존 정의를 유지합니다. 중복 단계 ID,
  존재하지 않는 단계 참조, 아직 지원하지 않는 의존성 및 feature flag 정책은 등록 시
  `OnboardingDefinitionInvalidProblem`으로 거부합니다.
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

### 단계 정의와 상태 필드

| 필드                                   | 현재 소비자와 의미                                                                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required`, `type`                     | `OnboardingManager.completeStep()`가 전체 완료에 필요한 단계를 결정합니다. 명시적 `required`가 우선합니다. 둘 다 없거나 `type: "required"`이면 필수, `type: "optional"` 또는 `"conditional"`이면 선택입니다. `conditional` 자체는 feature flag를 평가하지 않습니다. |
| `order`                                | 단계 표시 순서를 위한 공개 metadata입니다. 저장소와 manager는 정렬하지 않으며 현재 저장소 내 UI 소비자도 없습니다. 호출자가 표시 순서를 정할 때 사용할 수 있습니다.                                                                                                 |
| `description`, `metadata`              | 단계 표시와 호출자별 추가 정보를 위한 공개 metadata입니다. manager와 저장소는 읽지 않으며 현재 저장소 내 UI 소비자는 없습니다.                                                                                                                                      |
| `dependsOn`                            | 단계 간 실행 순서는 지원하지 않습니다. 비어 있지 않은 참조는 등록 시 거부하며 존재하지 않는 단계 참조는 별도로 식별합니다.                                                                                                                                          |
| `featureFlagKey`                       | feature flag 평가기는 연결되어 있지 않습니다. 값이 지정되면 등록 시 거부합니다.                                                                                                                                                                                     |
| `status`, `startedAt`, `currentStepId` | `OnboardingState`의 저장·조회 필드입니다. `InMemoryOnboardingStore`와 `DrizzleOnboardingStore`가 보존하며 사용자 정의 저장소는 conformance suite로 보존을 검증할 수 있습니다. manager는 이 필드를 계산하거나 전이시키지 않습니다.                                   |

### 분석 이벤트 이관

`OnboardingManager`는 저장 성공 시 `AnalyticsManager.capture(event, properties)`를 호출합니다.
공개 `OnboardingEvent`는 이 호출의 이름과 properties를 나타냅니다.

| event                       | properties                                                                     |
| --------------------------- | ------------------------------------------------------------------------------ |
| `onboarding_step_completed` | `{ onboardingId, stepId, stepTitle }`                                          |
| `onboarding_completed`      | `{ onboardingId, completedAt }` (`completedAt`은 저장소 결과가 제공할 때 존재) |

이전 `OnboardingEventType`의 `step_completed`는 실제 발행명인 `onboarding_step_completed`로
바꿔 구독해야 합니다. `step_skipped`와 `onboarding_started`는 이 manager에서 발행된 적이 없으므로
새 union에 포함되지 않습니다. `tenantId`, `userId`, `timestamp`, `metadata`는 manager의 event
properties가 아닙니다. 분석 provider가 컨텍스트 값을 별도로 주입할 수는 있습니다. 같은 단계의 재완료나
분석 전송 실패 뒤 재시도에서 이벤트가 다시 발행되지 않습니다.

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
- `OnboardingDefinitionInvalidProblem` - 중복 단계 ID, 잘못된 참조 또는 미지원 실행 정책을 등록할 때
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

```typescript no-check
import { DrizzleOnboardingStore } from "@croco/onboarding-drizzle";

const store = new DrizzleOnboardingStore(db, txManager);
const manager = new OnboardingManager(store, analytics);
```

## 테스트

```bash
pnpm test --filter=@croco/onboarding-core
```

## 라이선스

Apache-2.0
