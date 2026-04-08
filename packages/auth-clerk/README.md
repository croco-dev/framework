# @croco/auth-clerk

Clerk 인증 통합 패키지. @croco/auth-core 인터페이스를 Clerk Backend SDK로 구현합니다.

## 설치

```bash
pnpm add @croco/auth-clerk @clerk/backend
```

## 환경 변수

```bash
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

## 사용법

### ClerkAuthProvider

```typescript
import { ClerkAuthProvider } from '@croco/auth-clerk';

const authProvider = new ClerkAuthProvider({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

const user = await authProvider.authenticate(request);
```

### ClerkSessionProvider

```typescript
import { ClerkSessionProvider } from '@croco/auth-clerk';

const sessionProvider = new ClerkSessionProvider({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const session = await sessionProvider.getSession('sess_xxx');
const { sessions, totalCount } = await sessionProvider.listSessions({
  userId: 'user_xxx',
  status: 'active',
});
await sessionProvider.revokeSession('sess_xxx');
await sessionProvider.revokeAllSessions('user_xxx');
```

### ClerkUserService

```typescript
import { ClerkUserService } from '@croco/auth-clerk';

const userService = new ClerkUserService({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const user = await userService.getUser('user_xxx');
const { users } = await userService.getUserList({ limit: 10 });
const newUser = await userService.createUser({
  emailAddress: ['user@example.com'],
  firstName: 'John',
});
await userService.updateUser('user_xxx', { firstName: 'Jane' });
await userService.banUser('user_xxx');
```

### ClerkOrganizationService

```typescript
import { ClerkOrganizationService } from '@croco/auth-clerk';

const orgService = new ClerkOrganizationService({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const org = await orgService.getOrganization('org_xxx');
const { organizations } = await orgService.getOrganizationList();
const newOrg = await orgService.createOrganization({
  name: 'Acme Inc',
  createdBy: 'user_xxx',
});

await orgService.createOrganizationMembership({
  organizationId: 'org_xxx',
  userId: 'user_xxx',
  role: 'org:admin',
});

await orgService.createOrganizationInvitation({
  organizationId: 'org_xxx',
  emailAddress: 'new@example.com',
  role: 'org:member',
  inviterUserId: 'user_xxx',
});
```

### ClerkTenantMapper

```typescript
import { ClerkTenantMapper } from '@croco/auth-clerk';

const mapper = new ClerkTenantMapper();

await mapper.register('org_xxx', 'tenant_xxx');
const tenantId = await mapper.resolve('org_xxx');
```

### ClerkWebhookHandler

```typescript
import { ClerkWebhookHandler } from '@croco/auth-clerk';

const handler = new ClerkWebhookHandler(
  { signingSecret: process.env.CLERK_WEBHOOK_SECRET! },
  {
    'user.created': async (data) => {
      console.log('User created:', data.id);
    },
    'organization.created': async (data) => {
      console.log('Org created:', data.id);
    },
  }
);

await handler.handleWebhook(request);
```

## API

- `ClerkAuthProvider` - JWT 토큰 검증 및 인증
- `ClerkSessionProvider` - 세션 관리
- `ClerkUserService` - 사용자 CRUD
- `ClerkOrganizationService` - 조직/멤버십 관리
- `ClerkTenantMapper` - 테넌트 매핑
- `ClerkWebhookHandler` - 웹훅 처리
