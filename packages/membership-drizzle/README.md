# @croco/membership-drizzle

@croco/membership-core의 Drizzle ORM 기반 구현체입니다.

## 개요

`membership-drizzle`은 테넌트-사용자 멤버십 관리를 Drizzle ORM으로 구현한 저장소입니다.

## 설치

```bash
pnpm add @croco/membership-drizzle @croco/membership-core drizzle-orm
```

## 데이터베이스 스키마

```sql
CREATE TABLE memberships (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_memberships_tenant_id ON memberships(tenant_id);
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
```

## 사용법

### 기본 사용

```typescript
import { DrizzleMembershipStore, DRIZZLE_TOKEN } from '@croco/membership-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

const store = new DrizzleMembershipStore(db, txManager);

// 멤버 저장
const membership = await store.save({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin',
});

// 테넌트의 모든 멤버 조회
const members = await store.findAllByTenant('tenant-1');

// 역할별 멤버 수 조회
const adminCount = await store.countByRole('tenant-1', 'admin');
```

### DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject } from '@croco/framework-context';
import { MembershipManager, MembershipStore } from '@croco/membership-core';
import { DrizzleMembershipStore, DRIZZLE_TOKEN } from '@croco/membership-drizzle';

const DRIZZLE_DB_TOKEN = 'DRIZZLE_DB_TOKEN';
const TX_MANAGER_TOKEN = 'TX_MANAGER_TOKEN';

Container.set(MembershipStore, {
  factory: () => {
    const db = Container.get(DRIZZLE_DB_TOKEN);
    const txManager = Container.get(TX_MANAGER_TOKEN);
    return new DrizzleMembershipStore(db, txManager);
  },
});

@Component()
class TenantService {
  constructor(
    @Inject(MembershipStore) private store: DrizzleMembershipStore
  ) {}

  async getMemberCount(tenantId: string) {
    return await this.store.countAll(tenantId);
  }
}
```

## API

### DrizzleMembershipStore

`MembershipStore` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(
  db: DrizzleMembershipClient,
  txManager: TxManager<DrizzleMembershipClient>
)
```

#### Methods

- `findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null>` - 특정 멤버십 조회
- `findAllByTenant(tenantId: string): Promise<Membership[]>` - 테넌트의 모든 멤버십 조회
- `findAllByUser(userId: string): Promise<Membership[]>` - 사용자의 모든 멤버십 조회
- `save(input: MembershipCreateInput): Promise<Membership>` - 멤버십 저장 (upsert 지원)
- `delete(tenantId: string, userId: string): Promise<void>` - 멤버십 삭제
- `countByRole(tenantId: string, role: MembershipRole): Promise<number>` - 역할별 멤버 수
- `countAll(tenantId: string): Promise<number>` - 전체 멤버 수

### Schema

- `memberships` - 멤버십 테이블

## 타입

```typescript
type Membership = {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
};
```

## 트랜잭션 지원

`DrizzleMembershipStore`는 `@croco/tx-core`의 트랜잭션 매니저와 통합되어 있습니다. 활성 트랜잭션 컨텍스트가 있으면 자동으로 참여합니다.

```typescript
import { Transactional } from '@croco/tx-core';

class MyService {
  @Transactional()
  async transferOwnership(tenantId: string, fromUserId: string, toUserId: string) {
    // 같은 트랜잭션 내에서 실행
    await this.store.delete(tenantId, fromUserId);
    await this.store.save({ id: 'new-mem', tenantId, userId: toUserId, role: 'owner' });
  }
}
```

## 테스트

```bash
pnpm test --filter=@croco/membership-drizzle
```

## 라이선스

MIT
