# @croco/tenant-core

멀티테넌시 컨텍스트 관리 및 테넌트 격리를 위한 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/tenant-core
```

## 주요 기능

- **TenantManager**: AsyncLocalStorage 기반 테넌트 컨텍스트 관리
- **TenantResolver**: 다양한 테넌트 식별 전략 (Header, Subdomain, JWT)
- **TenantStore**: 테넌트 CRUD 및 설정 관리 인터페이스
- **TenantIsolationStrategy**: 데이터 격리 전략 (Schema-per-tenant, Row-level, Hybrid)
- **TenantGuard**: 테넌트 접근 제어

## 사용법

### TenantManager

```typescript
import { TenantManager } from '@croco/tenant-core';

const manager = new TenantManager();

// 테넌트 컨텍스트 내에서 실행
await manager.run('tenant-123', async () => {
  const tenantId = manager.getTenantId(); // 'tenant-123'
  // 비즈니스 로직
});

// 테넌트 컨텍스트 필수 확인
const requiredId = manager.requireTenantId(); // 없으면 TenantRequiredProblem 발생

// 컨텍스트 일시 중단 (크로스 테넌트 작업용)
await manager.suspend(async () => {
  // 여기서는 테넌트 컨텍스트 없음
});
```

### TenantResolver

```typescript
import { HeaderTenantResolver, SubdomainTenantResolver } from '@croco/tenant-core';

// Header 기반 테넌트 식별
const headerResolver = new HeaderTenantResolver({
  headerName: 'x-tenant-id',
});
const tenantId = await headerResolver.resolve(request);

// Subdomain 기반 테넌트 식별
const subdomainResolver = new SubdomainTenantResolver({
  domainSuffix: '.example.com',
});
const tenantId = await subdomainResolver.resolve({ url: 'https://acme.example.com/api' });
// 결과: 'acme'
```

### TenantStore (인터페이스)

```typescript
import type { TenantStore, Tenant, TenantFilter } from '@croco/tenant-core';

// Drizzle, Prisma 등으로 구현
class DrizzleTenantStore implements TenantStore {
  async findById(id: string): Promise<Tenant | null> {
    // 구현
  }
  // ... 기타 메서드
}
```

### TenantIsolationStrategy (인터페이스)

```typescript
import type { TenantIsolationStrategy } from '@croco/tenant-core';

// 3가지 격리 전략 지원
// - schema-per-tenant: 테넌트별 스키마
// - row-level: 테넌트 ID 컬럼 기반 필터링
// - hybrid: 테넌트별 전략 선택
```

### TenantGuard

```typescript
import { ActiveTenantGuard } from '@croco/tenant-core';

const guard = new ActiveTenantGuard({
  allowedStatuses: ['active', 'trial'],
});

const canAccess = guard.canAccess(tenant);
```

## API 요약

### Classes

| 클래스 | 설명 |
|--------|------|
| `TenantManager` | AsyncLocalStorage 기반 테넌트 컨텍스트 관리 |
| `TenantManagerRegistry` | 다중 TenantManager 인스턴스 등록/조회 |
| `HeaderTenantResolver` | HTTP 헤더에서 테넌트 ID 추출 |
| `SubdomainTenantResolver` | 서브도메인에서 테넌트 ID 추출 |
| `JwtTenantResolver` | JWT claims에서 테넌트 ID 추출 |
| `ActiveTenantGuard` | 활성 테넌트 접근 제어 |

### Interfaces

| 인터페이스 | 설명 |
|------------|------|
| `TenantResolver` | 테넌트 식별 컨트랙트 |
| `TenantStore` | 테넌트 저장소 컨트랙트 |
| `TenantIsolationStrategy` | 데이터 격리 전략 컨트랙트 |
| `TenantMiddleware` | 테넌트 미들웨어 컨트랙트 |
| `TenantGuard` | 테넌트 가드 컨트랙트 |

### Types

| 타입 | 설명 |
|------|------|
| `TenantContext` | AsyncLocalStorage에 저장되는 테넌트 컨텍스트 |
| `Tenant` | 테넌트 엔티티 |
| `TenantStatus` | 테넌트 상태 (active, inactive, suspended, trial, expired) |
| `TenantSettings` | 테넌트 설정 |
| `TenantFilter` | 테넌트 검색 필터 |

### Problems

| 예외 | 설명 |
|------|------|
| `TenantRequiredProblem` | 테넌트 컨텍스트 필요 시 발생 |
| `TenantNotFoundProblem` | 테넌트를 찾을 수 없을 때 발생 |
| `TenantManagerNotRegisteredProblem` | 등록되지 않은 TenantManager 조회 시 |
| `DuplicateTenantManagerRegistrationProblem` | 중복 등록 시 |

## 의존성

- `@croco/framework-context`: Context, AsyncLocalStorage
- `@croco/problems-core`: Problem 기반 에러 처리
- `@croco/telemetry-api`: OpenTelemetry 이벤트 기록
