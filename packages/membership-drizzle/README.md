# @croco/membership-drizzle

`@croco/membership-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/membership-drizzle @croco/membership-core @croco/tx-core drizzle-orm
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

Existing deployments must also run `setMembershipTimestampDefaults(client)` from
`@croco/membership-drizzle` to store new membership timestamps as UTC regardless of the PostgreSQL
session time zone. This migration can be run repeatedly. It preserves the `timestamp without time zone`
column types and does not correct timestamps in existing rows. Seat-limited inserts return the same
instants as ordinary inserts and subsequent reads, regardless of the Node.js process time zone.

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

## Pending event relay migration

Before deploying this version, run `addMembershipEventRelayAttempts(client)` after
`addMembershipEventIntents(client)`. The migration adds nullable `last_attempted_at` and a partial
index for each tenant's oldest pending intent. It preserves existing intents, publication markers,
command results and event IDs, and can be run repeatedly. It also changes new intent timestamps to
`clock_timestamp()` so commands serialized within one outer transaction retain their execution order.
Historical timestamp ties retain the existing `created_at, intent_id` ordering; their original execution
order cannot be recovered from the stored evidence.

Apply this migration explicitly before starting the new relay. There is no startup DDL. The additive
column and index may remain when rolling back application code; dropping them while a new relay is
running is unsupported. Use the existing database migration transaction and backup/recovery process.
A large production table may require a separately planned index deployment window.

The relay reads at most one pending head per tenant, ordered by the oldest recorded attempt (never
attempted first), then `created_at, intent_id`. Attempts use the PostgreSQL clock and survive service
or connection restarts. Run the relay outside request transactions so attempt evidence and publication
markers commit independently. Publishers must deduplicate concurrent/repeated deliveries by `eventId`.
A failed publisher or completion write keeps that tenant's successors blocked while other tenants proceed.
