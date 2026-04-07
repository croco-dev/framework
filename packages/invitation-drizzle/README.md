# @croco/invitation-drizzle

@croco/invitation-core의 Drizzle ORM 기반 구현체입니다.

## 개요

`invitation-drizzle`은 초대 및 도메인 정책 관리를 Drizzle ORM으로 구현한 저장소입니다.

## 설치

```bash
pnpm add @croco/invitation-drizzle @croco/invitation-core drizzle-orm
```

## 데이터베이스 스키마

### invitations 테이블

```sql
CREATE TABLE invitations (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL,
  email TEXT,
  token_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'link')),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked', 'declined')),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(token_hash)
);

CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX idx_invitations_tenant_id_email_status ON invitations(tenant_id, email, status);
```

### domain_policies 테이블

```sql
CREATE TABLE domain_policies (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(tenant_id, domain)
);

CREATE INDEX idx_domain_policies_tenant_id ON domain_policies(tenant_id);
```

## 사용법

### DrizzleInvitationStore

```typescript
import { DrizzleInvitationStore, DRIZZLE_INVITATION_TOKEN } from '@croco/invitation-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

const store = new DrizzleInvitationStore(db, txManager);

// 초대 저장
const invitation = await store.save({
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

// 토큰 해시로 초대 조회
const found = await store.findByTokenHash('hash-123');

// 상태 업데이트
const updated = await store.updateStatus('inv-1', 'accepted');

// 대기 중인 초대 수 조회 (rate limiting용)
const count = await store.countPendingByTenant('tenant-1', new Date(Date.now() - 24 * 60 * 60 * 1000));
```

### DrizzleDomainPolicyStore

```typescript
import { DrizzleDomainPolicyStore, DRIZZLE_DOMAIN_POLICY_TOKEN } from '@croco/invitation-drizzle';

const store = new DrizzleDomainPolicyStore(db, txManager);

// 도메인 정책 저장
const policy = await store.save({
  id: 'dp-1',
  tenantId: 'tenant-1',
  domain: 'example.com',
  role: 'member',
  enabled: true,
  createdAt: new Date(),
});

// 테넌트와 도메인으로 정책 조회
const found = await store.findByTenantAndDomain('tenant-1', 'example.com');

// 테넌트의 모든 정책 조회
const policies = await store.findAllByTenant('tenant-1');
```

### DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject } from '@croco/framework-context';
import { InvitationManager, InvitationStore } from '@croco/invitation-core';
import { DrizzleInvitationStore, DRIZZLE_INVITATION_TOKEN } from '@croco/invitation-drizzle';

const DRIZZLE_DB_TOKEN = 'DRIZZLE_DB_TOKEN';
const TX_MANAGER_TOKEN = 'TX_MANAGER_TOKEN';

Container.set(InvitationStore, {
  factory: () => {
    const db = Container.get(DRIZZLE_DB_TOKEN);
    const txManager = Container.get(TX_MANAGER_TOKEN);
    return new DrizzleInvitationStore(db, txManager);
  },
});

@Component()
class InvitationService {
  constructor(
    @Inject(InvitationStore) private store: DrizzleInvitationStore
  ) {}

  async getPendingInvitations(tenantId: string) {
    return await this.store.findAllByTenant(tenantId);
  }
}
```

## API

### DrizzleInvitationStore

`InvitationStore` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(
  db: DrizzleInvitationClient,
  txManager: TxManager<DrizzleInvitationClient>
)
```

#### Methods

- `findById(id: string): Promise<Invitation | null>` - ID로 초대 조회
- `findByTokenHash(tokenHash: string): Promise<Invitation | null>` - 토큰 해시로 초대 조회
- `findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null>` - 테넌트와 이메일로 초대 조회
- `findAllByTenant(tenantId: string): Promise<Invitation[]>` - 테넌트의 모든 초대 조회
- `save(invitation: Invitation): Promise<Invitation>` - 초대 저장 (upsert 지원)
- `updateStatus(id: string, status: InvitationStatus): Promise<Invitation | null>` - 초대 상태 업데이트
- `countPendingByTenant(tenantId: string, since: Date): Promise<number>` - 대기 중인 초대 수 조회 (rate limiting용)

### DrizzleDomainPolicyStore

`DomainPolicyStore` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(
  db: DrizzleDomainPolicyClient,
  txManager: TxManager<DrizzleDomainPolicyClient>
)
```

#### Methods

- `findByTenantAndDomain(tenantId: string, domain: string): Promise<DomainPolicy | null>` - 도메인 정책 조회
- `findAllByTenant(tenantId: string): Promise<DomainPolicy[]>` - 테넌트의 모든 도메인 정책 조회
- `save(policy: DomainPolicy): Promise<DomainPolicy>` - 도메인 정책 저장 (upsert 지원)
- `delete(tenantId: string, domain: string): Promise<void>` - 도메인 정책 삭제

### Schema

- `invitations` - 초대 테이블
- `domainPolicies` - 도메인 정책 테이블

## 타입

```typescript
type Invitation = {
  id: string;
  tenantId: string;
  inviterId: string;
  email: string | null;
  tokenHash: string;
  type: 'email' | 'link';
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'declined';
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

type DomainPolicy = {
  id: string;
  tenantId: string;
  domain: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  enabled: boolean;
  createdAt: Date;
};
```

## 트랜잭션 지원

두 저장소 모두 `@croco/tx-core`의 트랜잭션 매니저와 통합되어 있습니다.

```typescript
import { Transactional } from '@croco/tx-core';

class MyService {
  @Transactional()
  async acceptInvitation(token: string, userId: string) {
    // 같은 트랜잭션 내에서 실행
    const invitation = await this.invitationStore.findByTokenHash(token);
    await this.invitationStore.updateStatus(invitation.id, 'accepted');
    await this.membershipStore.save({ ... });
  }
}
```

## 테스트

```bash
pnpm test --filter=@croco/invitation-drizzle
```

## 라이선스

MIT
