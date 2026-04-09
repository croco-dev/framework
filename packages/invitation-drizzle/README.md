# @croco/invitation-drizzle

`@croco/invitation-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/invitation-drizzle @croco/invitation-core drizzle-orm
```

## 사용법

```typescript
import {
  DrizzleDomainPolicyStore,
  DrizzleInvitationStore,
} from '@croco/invitation-drizzle';
import { TxManager } from '@croco/tx-core';

const txManager = new TxManager(adapter, { defaultNesting: 'join' });
const invitationStore = new DrizzleInvitationStore(db, txManager);
const policyStore = new DrizzleDomainPolicyStore(db, txManager);

await invitationStore.save({
  id: 'inv-1',
  tenantId: 'tenant-1',
  inviterId: 'user-1',
  email: 'new@example.com',
  tokenHash: 'hash-123',
  type: 'email',
  role: 'member',
  status: 'pending',
  expiresAt: new Date('2026-12-31'),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date(),
});

await policyStore.save({
  id: 'policy-1',
  tenantId: 'tenant-1',
  domain: 'example.com',
  role: 'member',
  enabled: true,
  createdAt: new Date(),
});

const invitation = await invitationStore.findByTokenHash('hash-123');
const policy = await policyStore.findByTenantAndDomain('tenant-1', 'example.com');
```

## API 레퍼런스

### `DrizzleInvitationStore`

- `findById(id)`, ID로 초대를 조회합니다.
- `findByTokenHash(tokenHash)`, 토큰 해시로 초대를 조회합니다.
- `findByTenantAndEmail(tenantId, email)`, 테넌트와 이메일로 초대를 조회합니다.
- `findAllByTenant(tenantId)`, 테넌트의 모든 초대를 반환합니다.
- `save(invitation)`, 초대를 upsert로 저장합니다.
- `updateStatus(id, status)`, 초대 상태를 갱신합니다.
- `countPendingByTenant(tenantId, since)`, 기간 내 대기 초대 수를 반환합니다.

### `DrizzleDomainPolicyStore`

- `findByTenantAndDomain(tenantId, domain)`, 도메인 정책을 조회합니다.
- `findAllByTenant(tenantId)`, 테넌트의 모든 정책을 조회합니다.
- `save(policy)`, 도메인 정책을 upsert로 저장합니다.
- `delete(tenantId, domain)`, 도메인 정책을 삭제합니다.

### 스키마와 토큰

- `invitations`, 초대 엔터티 스키마입니다.
- `domainPolicies`, 도메인 정책 스키마입니다.
- `DRIZZLE_INVITATION_TOKEN`, 초대 저장소용 DB 토큰입니다.
- `DRIZZLE_DOMAIN_POLICY_TOKEN`, 도메인 정책 저장소용 DB 토큰입니다.
