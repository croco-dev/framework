# @croco/membership-drizzle

`@croco/membership-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/membership-drizzle @croco/membership-core drizzle-orm
```

## 사용법

```typescript
import { DrizzleMembershipStore } from '@croco/membership-drizzle';
import { TxManager } from '@croco/tx-core';

const txManager = new TxManager(adapter, { defaultNesting: 'join' });
const store = new DrizzleMembershipStore(db, txManager);

await store.save({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin',
});

const members = await store.findAllByTenant('tenant-1');
const adminCount = await store.countByRole('tenant-1', 'admin');
```

## API 레퍼런스

### `DrizzleMembershipStore`

- `findByTenantAndUser(tenantId, userId)`, 특정 멤버십을 조회합니다.
- `findAllByTenant(tenantId)`, 테넌트의 모든 멤버십을 반환합니다.
- `findAllByUser(userId)`, 사용자의 모든 멤버십을 반환합니다.
- `save(input)`, 멤버십을 upsert로 저장합니다.
- `delete(tenantId, userId)`, 멤버십을 삭제합니다.
- `countByRole(tenantId, role)`, 역할별 멤버 수를 반환합니다.
- `countAll(tenantId)`, 전체 멤버 수를 반환합니다.

### 스키마와 토큰

- `memberships`, 멤버십 엔터티 스키마입니다.
- `DRIZZLE_TOKEN`, 멤버십 저장소용 DB 토큰입니다.
