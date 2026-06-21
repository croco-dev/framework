# @croco/tenant-core

멀티테넌시 컨텍스트, 테넌트 식별, 접근 가드, 격리 전략을 제공하는 테넌트 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/tenant-core
```

## 사용법

```ts
import { TenantManager } from "@croco/tenant-core";

const tenantManager = new TenantManager();

await tenantManager.run("tenant-123", async () => {
  const tenantId = tenantManager.requireTenantId();
  void tenantId;
});
```

```ts
import { HeaderTenantResolver, SubdomainTenantResolver } from "@croco/tenant-core";

const headerResolver = new HeaderTenantResolver({ headerName: "x-tenant-id" });
const subdomainResolver = new SubdomainTenantResolver({ domainSuffix: ".example.com" });
```

```ts
import {
  createTenantIsolationEnforcer,
  createTenantRepositoryBoundary,
  markTenantScopedOperation,
} from "@croco/tenant-core";

const enforcer = createTenantIsolationEnforcer({ contextProvider: tenantManager });
const ordersBoundary = createTenantRepositoryBoundary(enforcer, { resource: "orders" });

await ordersBoundary.query(
  {
    operation: markTenantScopedOperation({
      name: "orders.findOpen",
      kind: "query",
    }),
    tenantColumn: "tenantId",
    predicates: [{ field: "tenantId", operator: "=", value: tenantManager.requireTenantId() }],
  },
  () => orderRepository.findOpen(),
);

await enforcer.enforce(
  markTenantScopedOperation({
    name: "admin.tenants.reindex",
    kind: "command",
    isolation: "admin-bypass",
    bypass: { reason: "support ticket T-100", actorId: "admin-1" },
  }),
  () => reindexTenants(),
);
```

## API 레퍼런스

### 핵심 클래스

- `TenantManager`, AsyncLocalStorage 기반 테넌트 컨텍스트 관리자입니다.
- `TenantIsolationEnforcer`, tenant-scoped repository/query/command 경계를 검증합니다.
- `TenantManagerRegistry`, 다중 TenantManager 등록과 조회를 담당합니다.
- `HeaderTenantResolver`, `SubdomainTenantResolver`, `JwtTenantResolver`, 요청에서 테넌트를 식별합니다.
- `ActiveTenantGuard`, 활성 상태 테넌트만 허용하는 가드입니다.

### 주요 타입과 인터페이스

- `Tenant`, `TenantStatus`, `TenantSettings`, `TenantFilter`
- `TenantContext`, `TenantResolutionResult`, `TenantIdentificationMethod`
- `TenantResolver`, `TenantStore`, `TenantGuard`, `TenantMiddleware`
- `TenantIsolationStrategy`, `TenantIsolationConfig`, `TenantIsolationType`
- `TenantScopedOperation`, `TenantContextRequirement`, `TenantRepositoryBoundary`
- `TenantQueryBoundary`, `TenantRlsEvidence`, `TenantIsolationAuditEvent`

### 문제 타입

- `TenantRequiredProblem`, `TenantNotFoundProblem`
- `TenantManagerNotRegisteredProblem`, `DuplicateTenantManagerRegistrationProblem`
- `TenantIsolationContextMissingProblem`, `TenantDefaultFallbackProblem`
- `TenantAdminBypassReasonRequiredProblem`, `TenantUnsafeQueryProblem`
- `TenantCrossTenantLeakProblem`

## 구현 포인트

- 데이터 격리 전략은 schema-per-tenant, row-level, hybrid 세 가지 모델을 지원합니다.
- resolver는 HTTP 헤더, JWT claim, 서브도메인 같은 환경별 식별 규칙을 교체할 수 있습니다.
- `suspend()`를 사용하면 관리 작업처럼 현재 테넌트 컨텍스트 없이 코드를 실행할 수 있습니다.
- `TenantIsolationEnforcer`는 tenant context 누락, `default` tenant fallback, cross-tenant query, admin/system bypass reason 누락을 deterministic Problem으로 실패시킵니다.
- Drizzle/RLS 같은 adapter는 `TenantRlsEvidence`를 전달해 RLS 설정이 활성 tenant와 일치하는지 검증할 수 있습니다.
- `createCrossTenantLeakFixture()`는 repository adapter별 cross-tenant leak 테스트 데이터를 재사용할 수 있게 합니다.
