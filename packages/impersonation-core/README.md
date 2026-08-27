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
import { ImpersonationService } from "@croco/impersonation-core";

const service = new ImpersonationService(store, authProvider, config);

// 사칭 시작
const session = await service.start(requestContext, "user-123", "Support request");

// 사칭 종료
await service.end(session.sessionId);

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
await eventPublisher.publish(event);
```

### ImpersonationEndedEvent

사칭 세션 종료 이벤트입니다.

```typescript
import { ImpersonationEndedEvent } from "@croco/impersonation-core";

const event = new ImpersonationEndedEvent(session);
await eventPublisher.publish(event);
```

### BlockDuringImpersonation 데코레이터

사칭 중 특정 작업을 차단합니다.

```typescript
import { BlockDuringImpersonation } from "@croco/impersonation-core";

class UserService {
  @BlockDuringImpersonation()
  async deleteUser(userId: string) {
    // 사칭 중에는 이 메서드 실행 불가
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
| `end(sessionId)`                        | 사칭 세션 종료                      |
| `isImpersonating(context)`              | 사칭 여부 확인                      |
| `getImpersonator(context)`              | 검증된 원래 사용자 ID 반환          |
| `getTargetUser(context)`                | 타겟 사용자 ID 반환                 |

`start`는 전달된 actor ID를 신뢰하지 않습니다. `AuthProvider.resolvePrincipal()`이 반환한 현재 principal을 사용하고,
`impersonation:manage` 권한과 `targetExists()` 결과를 서비스 경계에서 직접 검증합니다. `context.user.id`가 존재하는
경우 provider identity와 일치해야 하며, 모든 검증이 성공한 뒤 `ImpersonationStore.createIfNoActiveSession()`으로
actor별 세션을 원자적으로 생성합니다. 같은 actor의 동시 요청 중 하나만 성공하고 나머지는
`NestedImpersonationProblem`으로 거부됩니다.

### ImpersonationConfig

| 속성             | 타입     | 설명                    |
| ---------------- | -------- | ----------------------- |
| `maxDurationMs`  | number   | 최대 지속 시간 (밀리초) |
| `requireReason`  | boolean  | 사칭 사유 필수 여부     |
| `blockedActions` | string[] | 차단할 작업 목록        |

`ImpersonationService`는 생성 시 `maxDurationMs`가 만료 시각을 안전하게 표현할 수 있는 양의 정수인지,
`blockedActions`가 비어 있지 않은 작업 이름의 배열인지 검증합니다. `requireReason`이 활성화된 경우 `start()`는
reason의 앞뒤 공백을 제거한 뒤 빈 값이면 거부하며, 정규화된 reason만 세션과 시작 이벤트에 기록합니다.

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
import type { RequestContext } from "@croco/framework-context";
import {
  AuthProvider,
  ImpersonationService,
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

const service = new ImpersonationService(store, authProvider, config);

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

## 마이그레이션

기존 `start(impersonatorId, targetUserId, reason?)` 호출은 `start(context, targetUserId, reason?)`로 변경해야 합니다.
패키지 로컬 `AuthProvider` 구현은 `resolvePrincipal(context)`과 `targetExists(context, targetUserId)`를 제공해야 합니다.
이는 transport guard 없이 서비스를 직접 호출하는 경로에도 동일한 인증·권한·타겟 검증을 적용하기 위한 보안 계약 변경입니다.

커스텀 `ImpersonationStore` 구현은 기존 `save()` 대신 `createIfNoActiveSession()`을 구현해야 합니다. 이 연산은
`impersonatorId`별 활성 세션의 확인과 생성을 하나의 원자적 경계로 처리해야 하며, 영속 저장소는 unique constraint나
동등한 compare-and-set을 사용해 만료 세션 교체까지 같은 연산에서 보장해야 합니다.
