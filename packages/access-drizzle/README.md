# @croco/access-drizzle

`@croco/access-core`용 Drizzle 구현체입니다.

## 설치

```bash
pnpm add @croco/access-drizzle @croco/access-core drizzle-orm
```

## 사용법

```typescript
import { AccessEngine } from '@croco/access-core';
import { DrizzleAccessProvider } from '@croco/access-drizzle';

const provider = new DrizzleAccessProvider(db);
const engine = new AccessEngine(provider);

await engine.grant({
  tenantId: 'tenant-1',
  tuple: {
    object: 'document:1',
    relation: 'editor',
    subject: 'user:1',
  },
});

const result = await engine.check({
  tenantId: 'tenant-1',
  object: 'document:1',
  relation: 'editor',
  subject: 'user:1',
});
```

재귀 탐색은 최대 10단계까지 수행합니다.

## API 레퍼런스

### `DrizzleAccessProvider`

- `check(request)`, 관계 튜플과 재귀 경로를 기준으로 권한을 확인합니다.
- `grant(request)`, 관계 튜플을 추가합니다. 동일 튜플은 무시합니다.
- `revoke(request)`, 관계 튜플을 삭제합니다.
- `list(request)`, 조건에 맞는 관계 튜플을 조회합니다.

### `relationTuples`

권한 관계를 저장하는 기본 PostgreSQL 스키마입니다.

```sql
CREATE TABLE relation_tuples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  object TEXT NOT NULL,
  relation TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (tenant_id, object, relation, subject)
);
```
