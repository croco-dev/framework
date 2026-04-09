# @croco/auth-drizzle

`@croco/auth-core`용 Drizzle 저장소 모음입니다.

## 설치

```bash
pnpm add @croco/auth-drizzle @croco/auth-core drizzle-orm
```

## 사용법

```typescript
import {
  DrizzleApiKeyStore,
  DrizzleRoleRegistry,
  DrizzleSessionProvider,
  DrizzleTenantMappingProvider,
  apiKeys,
  sessions,
  tenantMappings,
  userRoles,
} from '@croco/auth-drizzle';

const apiKeyStore = new DrizzleApiKeyStore(db, { apiKeys });
const sessionProvider = new DrizzleSessionProvider(db, { sessions });
const tenantMappingProvider = new DrizzleTenantMappingProvider(db, { tenantMappings });
const roleRegistry = new DrizzleRoleRegistry(db, { userRoles });

await tenantMappingProvider.register('org-1', 'tenant-1');
await apiKeyStore.save({
  prefix: 'pk_live',
  shortToken: 'abc123',
  hash: 'hashed-token',
  permissions: ['users:read'],
  name: 'server',
  tenantId: 'tenant-1',
  createdBy: 'user-1',
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
});
roleRegistry.registerRole('admin', { permissions: ['users:read', 'users:write'] });
await roleRegistry.assignRole('user-1', 'tenant-1', 'admin');
const activeSessions = await sessionProvider.listSessions({ userId: 'user-1', status: 'active' });
```

## API 레퍼런스

### 저장소

- `DrizzleApiKeyStore`, API 키 저장, 조회, 폐기, 삭제를 담당합니다.
- `DrizzleSessionProvider`, 세션 조회와 회수를 담당합니다.
- `DrizzleTenantMappingProvider`, 외부 조직 ID와 테넌트 ID를 연결합니다.
- `DrizzleRoleRegistry`, 역할 정의 등록과 사용자 역할 할당을 담당합니다.

### 스키마

- `apiKeys`, API 키 테이블입니다.
- `sessions`, 세션 테이블입니다.
- `tenantMappings`, 외부 조직 매핑 테이블입니다.
- `userRoles`, 사용자 역할 테이블입니다.

각 스키마는 PostgreSQL용 `pgTable` 정의이며, 인덱스와 유니크 제약을 함께 제공합니다.
