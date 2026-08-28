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
  addApiKeyRotations,
  apiKeyRotations,
  apiKeys,
  sessions,
  tenantMappings,
  userRoles,
} from "@croco/auth-drizzle";

await addApiKeyRotations(db);
const apiKeyStore = new DrizzleApiKeyStore(db, { apiKeys, apiKeyRotations });
const sessionProvider = new DrizzleSessionProvider(db, { sessions });
const tenantMappingProvider = new DrizzleTenantMappingProvider(db, { tenantMappings });
const roleRegistry = new DrizzleRoleRegistry(db, { userRoles });

await tenantMappingProvider.register("org-1", "tenant-1");
await apiKeyStore.save({
  prefix: "pk_live",
  shortToken: "abc123",
  hash: "hashed-token",
  permissions: ["users:read"],
  name: "server",
  tenantId: "tenant-1",
  createdBy: "user-1",
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
});
roleRegistry.registerRole("admin", { permissions: ["users:read", "users:write"] });
await roleRegistry.assignRole("user-1", "tenant-1", "admin");
const activeSessions = await sessionProvider.listSessions({ userId: "user-1", status: "active" });
```

`listSessions()`는 최신 생성 세션부터 ID로 순서를 고정하며, `totalCount`에는 페이지 크기와 무관한 전체 일치 건수를
반환합니다.

## API 레퍼런스

### 저장소

- `DrizzleApiKeyStore`, API 키 저장, 조회, 원자적 회전, 폐기, 삭제를 담당합니다.
- `DrizzleSessionProvider`, 세션 조회와 회수를 담당합니다.
- `DrizzleTenantMappingProvider`, 외부 조직 ID와 테넌트 ID를 연결합니다.
- `DrizzleRoleRegistry`, 역할 정의 등록과 사용자 역할 할당을 담당합니다.

### 스키마

- `apiKeys`, API 키 테이블입니다.
- `apiKeyRotations`, 멱등 회전, 보호된 복구 자료, 이벤트 전달 상태 테이블입니다.
- `sessions`, 세션 테이블입니다.
- `tenantMappings`, 외부 조직 매핑 테이블입니다.
- `userRoles`, 사용자 역할 테이블입니다.

각 스키마는 PostgreSQL용 `pgTable` 정의이며, 인덱스와 유니크 제약을 함께 제공합니다.

`addApiKeyRotations()`를 애플리케이션 스키마 마이그레이션에 포함해야 합니다. 회전은 내부 PostgreSQL 트랜잭션으로
대체 키 저장과 기존 키 폐기를 함께 커밋하며, 회전 이벤트는 커밋 뒤 안정적인 이벤트 ID로 전달됩니다.

기존 `save()` 후 `revoke()` 회전 경로를 사용하는 인스턴스와 새 원자적 회전 경로를 동시에 실행하면 안 됩니다.
배포할 때는 먼저 마이그레이션을 적용하고 API 키 회전을 중지한 뒤, 기존 회전 writer를 모두 drain하고 새 버전을
배포한 다음 회전을 다시 활성화합니다. 이 schema-first 2단계 절차를 지키지 않는 mixed-version rollout은 지원하지
않습니다. `delete()`는 키와 연결된 회전 복구 자료를 같은 트랜잭션에서 영구 삭제합니다.
