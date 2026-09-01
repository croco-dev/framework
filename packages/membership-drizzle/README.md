# @croco/membership-drizzle

`@croco/membership-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/membership-drizzle @croco/membership-core drizzle-orm
```

## 사용법

```typescript
import { DrizzleMembershipStore } from "@croco/membership-drizzle";
import { MembershipService } from "@croco/membership-core";
import { TxManager } from "@croco/tx-core";

const txManager = new TxManager(adapter, { defaultNesting: "join" });
const store = new DrizzleMembershipStore(db, txManager);
const memberships = new MembershipService({
  store,
});

await memberships.addMember("tenant-1", "user-1", "admin", "membership:add:user-1");

const members = await store.findAllByTenant("tenant-1");
const adminCount = await store.countByRole("tenant-1", "admin");
```

Existing deployments must run `addMembershipEventIntents(client)` before using atomic membership commands. It creates the idempotency and recoverable event-intent tables without modifying membership rows.

## API 레퍼런스

### `DrizzleMembershipStore`

- `findByTenantAndUser(tenantId, userId)`, 특정 멤버십을 조회합니다.
- `findAllByTenant(tenantId)`, 테넌트의 모든 멤버십을 반환합니다.
- `findAllByUser(userId)`, 사용자의 모든 멤버십을 반환합니다.
- `execute(command)`, idempotency record와 복구 가능한 event intent를 멤버십 변경과 같은 트랜잭션에 저장합니다.
- `countByRole(tenantId, role)`, 역할별 멤버 수를 반환합니다.
- `countAll(tenantId)`, 전체 멤버 수를 반환합니다.

애플리케이션 쓰기는 `MembershipService` 또는 `execute(command)`를 사용해야 합니다. adapter 내부의
`save`, `delete`, `mutateOwner`, `transferOwnership` primitive는 보호된 구현 세부사항이며 idempotency record나
event intent를 독립적으로 만들지 않습니다.

owner 변경은 `READ COMMITTED`와 `REPEATABLE READ`에서 같은 테넌트의 현재 owner 행을 공통 충돌점으로 사용합니다.
직렬화 실패는 서비스 계층이 안정적인 last-owner 또는 ownership-transfer Problem으로 변환할 수 있는 `conflict`
결과로 정규화됩니다.

실제 PostgreSQL 동시성 검증은 `MEMBERSHIP_POSTGRES_URL`을 지정하면 패키지 테스트에 포함됩니다.

### 스키마와 토큰

- `memberships`, 멤버십 엔터티 스키마입니다.
- `DRIZZLE_TOKEN`, 멤버십 저장소용 DB 토큰입니다.
