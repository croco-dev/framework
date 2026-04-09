# @croco/auth-clerk

Clerk Backend SDK를 Croco 인증, 세션, 조직 API에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/auth-clerk @clerk/backend
```

## 사용법

### 1. 토큰 인증

```typescript
import { ClerkAuthProvider } from '@croco/auth-clerk';

const authProvider = new ClerkAuthProvider({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

const user = await authProvider.authenticate(request);
```

### 2. 세션 조회와 해제

```typescript
import { ClerkSessionProvider } from '@croco/auth-clerk';

const sessions = new ClerkSessionProvider({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const session = await sessions.getSession('sess_123');
await sessions.revokeAllSessions('user_123');
```

### 3. 사용자와 조직 관리

```typescript
import { ClerkOrganizationService, ClerkUserService } from '@croco/auth-clerk';

const options = { secretKey: process.env.CLERK_SECRET_KEY! };
const users = new ClerkUserService(options);
const organizations = new ClerkOrganizationService(options);

await users.createUser({
  emailAddress: ['owner@example.com'],
  firstName: 'Croco',
});

await organizations.createOrganization({
  name: 'Croco Team',
  createdBy: 'user_123',
});
```

### 4. 테넌트 매핑

```typescript
import { ClerkTenantMapper } from '@croco/auth-clerk';

const mapper = new ClerkTenantMapper();
await mapper.register('org_123', 'tenant_123');
const tenantId = await mapper.resolve('org_123');
```

### 5. 웹훅 처리

```typescript
import { ClerkWebhookHandler } from '@croco/auth-clerk';

const handler = new ClerkWebhookHandler(
  { signingSecret: process.env.CLERK_WEBHOOK_SECRET! },
  {
    'user.created': async (event) => {
      await syncUser(event.id);
    },
  }
);

await handler.handleWebhook(request);
```

## API 레퍼런스

| API | 설명 |
|---|---|
| `ClerkAuthProvider` | Bearer 토큰을 검증하고 `AuthUser`를 반환합니다. |
| `ClerkSessionProvider` | Clerk 세션 조회, 목록 조회, 세션 해제를 처리합니다. |
| `ClerkUserService` | 사용자 조회, 생성, 수정, 삭제, 밴 관리를 제공합니다. |
| `ClerkOrganizationService` | 조직, 멤버십, 초대 관리를 제공합니다. |
| `ClerkTenantMapper` | Clerk 조직 ID와 Croco tenant ID를 매핑합니다. |
| `ClerkWebhookHandler` | Clerk 서명을 검증하고 이벤트별 핸들러를 실행합니다. |
| `WebhookVerificationProblem` 외 Problem | 토큰, 웹훅, tenant 매핑 오류를 Problem 형태로 제공합니다. |

## 공개 타입

- `ClerkAuthOptions`
- `ClerkUser`, `CreateClerkUserInput`, `UpdateClerkUserInput`
- `ClerkOrganization`, `CreateOrganizationInput`, `CreateInvitationInput`
- `ClerkTenantRequest`, `TenantMappingStore`
- `WebhookHandlerOptions`, `WebhookEventHandler`, `WebhookEventType`
