# @croco/impersonation-core

사용자 사칭(Impersonation) 기능을 위한 핵심 패키지입니다. 관리자가 다른 사용자로 로그인하여 지원을 제공할 수 있습니다.

## 설치

```bash
pnpm add @croco/impersonation-core
```

## 주요 기능

### ImpersonationService

사칭 세션 관리를 위한 서비스입니다.

```typescript
import {
  ImpersonationLifecycleEventPublisher,
  ImpersonationService,
} from "@croco/impersonation-core";

const service = new ImpersonationService(store, authProvider, config, lifecycleEventPublisher);

// 사칭 시작
const session = await service.start(requestContext, "user-123", "Support request");

// 사칭 종료
await service.end(requestContext, session.sessionId);

// 발행 실패 후 저장된 lifecycle intent 재시도
await service.publishPendingEvents();

// 컨텍스트에서 사칭 여부 확인
const isImpersonating = service.isImpersonating(context);

// 사칭자 ID 가져오기
const impersonatorId = service.getImpersonator(context);

// 타겟 사용자 ID 가져오기
const targetUserId = service.getTargetUser(context);
```

### ImpersonationContext

사칭 컨텍스트 타입은 `RequestContext`를 확장합니다.

```typescript
import type { ImpersonationContext } from "@croco/impersonation-core";

const context: ImpersonationContext = {
  requestId: "req-1",
  impersonation: {
    sessionId: "imp-123",
    impersonatorId: "admin-1",
    targetUserId: "user-123",
    reason: "Support request",
    startedAt: new Date(),
    expiresAt: new Date(),
  },
};
```

### ImpersonationStartedEvent

사칭 세션 시작 이벤트입니다.

```typescript
import { ImpersonationStartedEvent } from "@croco/impersonation-core";

const event = new ImpersonationStartedEvent(session);
await lifecycleEventPublisher.publishIdempotently(event);
```

### ImpersonationEndedEvent

사칭 세션 종료 이벤트입니다.

```typescript
import { ImpersonationEndedEvent } from "@croco/impersonation-core";

const event = new ImpersonationEndedEvent(session);
await lifecycleEventPublisher.publishIdempotently(event);
```

### BlockDuringImpersonation 데코레이터

사칭 중 `blockedActions`에 등록된 작업만 차단합니다. 작업 식별자는 데코레이터가 붙은 메서드 이름이며 정확히 일치해야
합니다. 설정은 `IMPERSONATION_CONFIG_TOKEN`으로 등록해야 하며, 설정이 없거나 식별자에 공백이 있거나 중복되면
`IMPERSONATION_CONFIGURATION_INVALID`로 실패합니다.

```typescript
import { Container } from "@croco/framework-context";
import { BlockDuringImpersonation, IMPERSONATION_CONFIG_TOKEN } from "@croco/impersonation-core";

Container.set(IMPERSONATION_CONFIG_TOKEN, {
  maxDurationMs: 30 * 60 * 1000,
  requireReason: true,
  blockedActions: ["deleteUser"],
});

class UserService {
  @BlockDuringImpersonation()
  async deleteUser(userId: string) {
    // blockedActions에 deleteUser가 있으므로 사칭 중에는 실행 불가
  }
}
```

### ImpersonationGuard

사칭 여부를 확인하고 차단합니다.

```typescript
import { ImpersonationGuard } from "@croco/impersonation-core";

const guard = new ImpersonationGuard();

guard.canActivate(routeExecutionContext);
```

### InMemoryImpersonationStore

인메모리 사칭 세션 저장소입니다.

```typescript
import { InMemoryImpersonationStore } from "@croco/impersonation-core";

const store = new InMemoryImpersonationStore();
```

## API

### ImpersonationService

| 메서드                                  | 설명                                |
| --------------------------------------- | ----------------------------------- |
| `start(context, targetUserId, reason?)` | 인증된 현재 사용자로 사칭 세션 시작 |
| `end(context, sessionId)`               | 인증된 원래 사칭자로 세션 종료      |
| `isImpersonating(context)`              | 사칭 여부 확인                      |
| `getImpersonator(context)`              | 검증된 원래 사용자 ID 반환          |
| `getTargetUser(context)`                | 타겟 사용자 ID 반환                 |
| `publishPendingEvents(limit?)`          | pending lifecycle event 재발행      |
| `getLifecycleDiagnostics(limit?)`       | lifecycle reconciliation 상태 조회  |

`start`는 전달된 actor ID를 신뢰하지 않습니다. `AuthProvider.resolvePrincipal()`이 반환한 현재 principal을 사용하고,
`impersonation:manage` 권한과 `targetExists()` 결과를 서비스 경계에서 직접 검증합니다. `context.user.id`가 존재하는
경우 provider identity와 일치해야 하며, 모든 검증이 성공한 뒤 `ImpersonationStore.commitStart()`로
actor별 세션과 시작 event intent를 원자적으로 저장합니다. 같은 actor의 동시 요청 중 하나만 성공하고 나머지는
`NestedImpersonationProblem`으로 거부됩니다.

`end`도 같은 principal과 전역 `impersonation:manage` 권한을 검증하며, 세션을 시작한 원래 impersonator만 종료할 수
있습니다. 인증, 권한, 요청 identity 또는 세션 actor 검증이 실패하면 세션은 유지되고 종료 이벤트도 발행되지 않습니다.
`ImpersonationStore.commitEnd(intent, impersonatorId)` 구현은 actor 검증, 세션 제거, 종료 event intent 저장을 하나의
원자적 연산으로 수행하고 단일 호출자에게만 `committed` 결과를 반환해야 합니다.

세션 시작과 종료는 각각 lifecycle event intent와 하나의 원자적 저장소 전환으로 커밋됩니다. 발행 또는 acknowledgement가
실패하면 `IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING` Problem이 `sessionId`, `eventId`, lifecycle, 실패 단계와
`pending` reconciliation 상태를 제공합니다. `publishPendingEvents()`는 저장된 identity와 발생 시각을 유지해 재발행하며,
`ImpersonationLifecycleEventPublisher` 구현은 같은 `eventId`의 재시도와 동시 전달을 중복 제거해야 합니다.
시작 이벤트가 아직 pending인 세션을 종료하면 종료 상태와 이벤트 intent는 함께 커밋되지만 종료 이벤트를 먼저 발행하지
않습니다. 재발행 시에는 같은 세션의 시작 이벤트가 종료 이벤트보다 먼저 전달됩니다.

`getLifecycleDiagnostics()`는 pending intent가 있으면 `reconciliation_required`, 없으면 `healthy`를 반환합니다.
커스텀 `ImpersonationStore`는 `commitStart()`와 `commitEnd()`에서 세션 상태와 intent를 반드시 원자적으로 저장하고,
세션 ID를 재사용하지 않으며, pending intent 조회와 idempotent acknowledgement를 구현해야 합니다.

### ImpersonationConfig

| 속성             | 타입     | 설명                    |
| ---------------- | -------- | ----------------------- |
| `maxDurationMs`  | number   | 최대 지속 시간 (밀리초) |
| `requireReason`  | boolean  | 사칭 사유 필수 여부     |
| `blockedActions` | string[] | 차단할 작업 목록        |

`ImpersonationService`는 생성 시 `maxDurationMs`가 만료 시각을 안전하게 표현할 수 있는 양의 정수인지,
`requireReason`이 불리언인지, `blockedActions`가 공백 없이 정규화된 고유 작업 이름의 배열인지 검증합니다.
`BlockDuringImpersonation`은 사칭 중에
데코레이터가 붙은 메서드 이름이 이 목록에 있을 때만 작업을 거부합니다. 차단 경계가 같은 설정을 읽을 수 있도록
`IMPERSONATION_CONFIG_TOKEN`으로 설정을 등록해야 합니다. `requireReason`이 활성화된 경우 `start()`는 reason의 앞뒤
공백을 제거한 뒤 빈 값이면 거부하며, 정규화된 reason만 세션과 시작 이벤트에 기록합니다.

### ImpersonationState

| 속성             | 타입                | 설명           |
| ---------------- | ------------------- | -------------- |
| `sessionId`      | string              | 세션 ID        |
| `impersonatorId` | string              | 사칭자 ID      |
| `targetUserId`   | string              | 타겟 사용자 ID |
| `reason`         | string \| undefined | 사칭 사유      |
| `startedAt`      | Date                | 시작 시간      |
| `expiresAt`      | Date                | 만료 시간      |

## 타입 안전성

모든 타입은 strict TypeScript 모드에서 안전하게 동작합니다.

- `as any` 사용 없이 타입 추론이 완벽하게 동작
- 모든 컨텍스트 타입은 타입 가드와 함께 사용 가능

## 사용 예시

### 완전한 예시

```typescript
import "reflect-metadata";
import { Container, type RequestContext } from "@croco/framework-context";
import {
  AuthProvider,
  IMPERSONATION_CONFIG_TOKEN,
  ImpersonationEndedEvent,
  ImpersonationLifecycleEventPublisher,
  ImpersonationService,
  ImpersonationStartedEvent,
  InMemoryImpersonationStore,
} from "@croco/impersonation-core";
import type { ImpersonationContext, ImpersonationPrincipal } from "@croco/impersonation-core";

class MyAuthProvider extends AuthProvider {
  async resolvePrincipal(context: RequestContext): Promise<ImpersonationPrincipal | null> {
    if (!context.user) return null;
    return {
      id: context.user.id,
      permissions: ["impersonation:manage"],
    };
  }

  async targetExists(_context: RequestContext, targetUserId: string): Promise<boolean> {
    return targetUserId === "user-123";
  }
}

const store = new InMemoryImpersonationStore();
const authProvider = new MyAuthProvider();
const config = {
  maxDurationMs: 30 * 60 * 1000,
  requireReason: true,
  blockedActions: ["deleteUser", "updatePassword"],
};

Container.set(IMPERSONATION_CONFIG_TOKEN, config);
class MyLifecycleEventPublisher extends ImpersonationLifecycleEventPublisher {
  private readonly publishedEventIds = new Set<string>();

  publishIdempotently(event: ImpersonationStartedEvent | ImpersonationEndedEvent): Promise<void> {
    if (this.publishedEventIds.has(event.eventId)) return Promise.resolve();

    this.publishedEventIds.add(event.eventId);
    console.log(event);
    return Promise.resolve();
  }
}

const service = new ImpersonationService(
  store,
  authProvider,
  config,
  new MyLifecycleEventPublisher(),
);

const requestContext: RequestContext = {
  requestId: "req-1",
  user: { id: "admin-1" },
};

const session = await service.start(requestContext, "user-123", "Customer support");

const context: ImpersonationContext = {
  requestId: "req-1",
  impersonation: session,
};

const isImpersonating = service.isImpersonating(context);
console.log(isImpersonating);
```

이 예시는 프로세스 내 중복 제거를 보여 줍니다. 운영 환경에서는 같은 `eventId`를 영속적으로 중복 제거하는 durable event
bus 또는 outbox 구현으로 `MyLifecycleEventPublisher`를 교체해야 합니다.

## 마이그레이션

기존 `start(impersonatorId, targetUserId, reason?)` 호출은 `start(context, targetUserId, reason?)`로 변경해야 합니다.
패키지 로컬 `AuthProvider` 구현은 `resolvePrincipal(context)`과 `targetExists(context, targetUserId)`를 제공해야 합니다.
이는 transport guard 없이 서비스를 직접 호출하는 경로에도 동일한 인증·권한·타겟 검증을 적용하기 위한 보안 계약 변경입니다.

커스텀 `ImpersonationStore` 구현은 기존 `save()` 대신 `commitStart()`와 `commitEnd()`를 구현해야 합니다.
`commitStart()`는 `impersonatorId`별 활성 세션 확인, 생성, 시작 event intent 저장을 하나의 원자적 경계로 처리해야 하며,
영속 저장소는 세션 ID 재사용을 막고 unique constraint나 동등한 compare-and-set을 사용해 만료 세션 교체까지 같은
연산에서 보장해야 합니다.
