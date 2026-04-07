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
import { ImpersonationService } from '@croco/impersonation-core';

const service = new ImpersonationService(store, authProvider, config);

// 사칭 시작
const session = await service.start('admin-1', 'user-123', 'Support request');

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
import type { ImpersonationContext } from '@croco/impersonation-core';

const context: ImpersonationContext = {
  requestId: 'req-1',
  impersonation: {
    sessionId: 'imp-123',
    impersonatorId: 'admin-1',
    targetUserId: 'user-123',
    reason: 'Support request',
    startedAt: new Date(),
    expiresAt: new Date(),
  },
};
```

### ImpersonationStartedEvent

사칭 세션 시작 이벤트입니다.

```typescript
import { ImpersonationStartedEvent } from '@croco/impersonation-core';

const event = new ImpersonationStartedEvent(session);
await eventPublisher.publish(event);
```

### ImpersonationEndedEvent

사칭 세션 종료 이벤트입니다.

```typescript
import { ImpersonationEndedEvent } from '@croco/impersonation-core';

const event = new ImpersonationEndedEvent(session);
await eventPublisher.publish(event);
```

### BlockDuringImpersonation 데코레이터

사칭 중 특정 작업을 차단합니다.

```typescript
import { BlockDuringImpersonation } from '@croco/impersonation-core';

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
import { ImpersonationGuard } from '@croco/impersonation-core';

const guard = new ImpersonationGuard(service);

if (guard.canPerformAction(context, 'deleteUser')) {
  // 작업 수행
}
```

### InMemoryImpersonationStore

인메모리 사칭 세션 저장소입니다.

```typescript
import { InMemoryImpersonationStore } from '@croco/impersonation-core';

const store = new InMemoryImpersonationStore();
```

## API

### ImpersonationService

| 메서드 | 설명 |
|--------|------|
| `start(impersonatorId, targetUserId, reason?)` | 사칭 세션 시작 |
| `end(sessionId)` | 사칭 세션 종료 |
| `isImpersonating(context)` | 사칭 여부 확인 |
| `getImpersonator(context)` | 사칭자 ID 반환 |
| `getTargetUser(context)` | 타겟 사용자 ID 반환 |

### ImpersonationConfig

| 속성 | 타입 | 설명 |
|------|------|------|
| `maxDurationMs` | number | 최대 지속 시간 (밀리초) |
| `requireReason` | boolean | 사칭 사유 필수 여부 |
| `blockedActions` | string[] | 차단할 작업 목록 |

### ImpersonationState

| 속성 | 타입 | 설명 |
|------|------|------|
| `sessionId` | string | 세션 ID |
| `impersonatorId` | string | 사칭자 ID |
| `targetUserId` | string | 타겟 사용자 ID |
| `reason` | string \| undefined | 사칭 사유 |
| `startedAt` | Date | 시작 시간 |
| `expiresAt` | Date | 만료 시간 |

## 타입 안전성

모든 타입은 strict TypeScript 모드에서 안전하게 동작합니다.

- `as any` 사용 없이 타입 추론이 완벽하게 동작
- 모든 컨텍스트 타입은 타입 가드와 함께 사용 가능

## 사용 예시

### 완전한 예시

```typescript
import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { ImpersonationService } from '@croco/impersonation-core';
import { InMemoryImpersonationStore } from '@croco/impersonation-core';
import type { AuthProvider } from '@croco/impersonation-core';

class MyAuthProvider implements AuthProvider {
  getCurrentUserId(): string | null {
    return 'admin-1';
  }
}

const store = new InMemoryImpersonationStore();
const authProvider = new MyAuthProvider();
const config = {
  maxDurationMs: 30 * 60 * 1000,
  requireReason: true,
  blockedActions: ['deleteUser', 'updatePassword'],
};

const service = new ImpersonationService(store, authProvider, config);

const session = await service.start('admin-1', 'user-123', 'Customer support');

const context: ImpersonationContext = {
  requestId: 'req-1',
  impersonation: session,
};

const isImpersonating = service.isImpersonating(context);
console.log(isImpersonating);