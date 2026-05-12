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

## API 레퍼런스

### 핵심 클래스

- `TenantManager`, AsyncLocalStorage 기반 테넌트 컨텍스트 관리자입니다.
- `TenantManagerRegistry`, 다중 TenantManager 등록과 조회를 담당합니다.
- `HeaderTenantResolver`, `SubdomainTenantResolver`, `JwtTenantResolver`, 요청에서 테넌트를 식별합니다.
- `ActiveTenantGuard`, 활성 상태 테넌트만 허용하는 가드입니다.

### 주요 타입과 인터페이스

- `Tenant`, `TenantStatus`, `TenantSettings`, `TenantFilter`
- `TenantContext`, `TenantResolutionResult`, `TenantIdentificationMethod`
- `TenantResolver`, `TenantStore`, `TenantGuard`, `TenantMiddleware`
- `TenantIsolationStrategy`, `TenantIsolationConfig`, `TenantIsolationType`

### 문제 타입

- `TenantRequiredProblem`, `TenantNotFoundProblem`
- `TenantManagerNotRegisteredProblem`, `DuplicateTenantManagerRegistrationProblem`

## 구현 포인트

- 데이터 격리 전략은 schema-per-tenant, row-level, hybrid 세 가지 모델을 지원합니다.
- resolver는 HTTP 헤더, JWT claim, 서브도메인 같은 환경별 식별 규칙을 교체할 수 있습니다.
- `suspend()`를 사용하면 관리 작업처럼 현재 테넌트 컨텍스트 없이 코드를 실행할 수 있습니다.
