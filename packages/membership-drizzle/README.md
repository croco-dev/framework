# @croco/membership-drizzle

`@croco/membership-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/membership-drizzle @croco/membership-core drizzle-orm
```

## 사용법

```typescript
import { DrizzleMembershipStore } from "@croco/membership-drizzle";
import { TxManager } from "@croco/tx-core";

const txManager = new TxManager(adapter, { defaultNesting: "join" });
const store = new DrizzleMembershipStore(db, txManager);

await store.save({
  id: "mem-1",
  tenantId: "tenant-1",
  userId: "user-1",
  role: "admin",
});

const members = await store.findAllByTenant("tenant-1");
const adminCount = await store.countByRole("tenant-1", "admin");
```

Existing deployments must run `addMembershipEventIntents(client)` before using atomic membership commands. It creates the idempotency and recoverable event-intent tables without modifying membership rows.

## API 레퍼런스

### `DrizzleMembershipStore`

- `findByTenantAndUser(tenantId, userId)`, 특정 멤버십을 조회합니다.
- `findAllByTenant(tenantId)`, 테넌트의 모든 멤버십을 반환합니다.
- `findAllByUser(userId)`, 사용자의 모든 멤버십을 반환합니다.
- `save(input)`, 멤버십을 upsert로 저장합니다.
- `delete(tenantId, userId)`, 멤버십을 삭제합니다.
- `mutateOwner(input)`, 현재 owner 행을 잠그고 제거 또는 강등을 조건부로 적용합니다.
- `transferOwnership(input)`, 두 역할을 하나의 조건부 업데이트로 변경합니다.
- `countByRole(tenantId, role)`, 역할별 멤버 수를 반환합니다.
- `countAll(tenantId)`, 전체 멤버 수를 반환합니다.

owner 변경은 `READ COMMITTED`와 `REPEATABLE READ`에서 같은 테넌트의 현재 owner 행을 공통 충돌점으로 사용합니다.
직렬화 실패는 서비스 계층이 안정적인 last-owner 또는 ownership-transfer Problem으로 변환할 수 있는 `conflict`
결과로 정규화됩니다.

실제 PostgreSQL 동시성 검증은 `MEMBERSHIP_POSTGRES_URL`을 지정하면 패키지 테스트에 포함됩니다.

### 스키마와 토큰

- `memberships`, 멤버십 엔터티 스키마입니다.
- `DRIZZLE_TOKEN`, 멤버십 저장소용 DB 토큰입니다.
