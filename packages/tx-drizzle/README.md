# @croco/tx-drizzle

Drizzle ORM용 `@croco/tx-core` 트랜잭션 어댑터입니다. Drizzle의 `db.transaction`/`tx.transaction(savepoint)`을 `tx-core`에 연결합니다.

## 설치

```bash
pnpm add @croco/tx-drizzle @croco/tx-core drizzle-orm typedi
```

## 사용법

### 1. Drizzle DB 생성 및 어댑터 연결

```ts
import 'reflect-metadata';
import { Container } from 'typedi';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

Container.set(TxManager, txManager);
```

### 2. @croco/utils-node의 containerSetup에서 등록

```ts
import 'reflect-metadata';
import { createServer } from '@croco/utils-node';
import { Container } from 'typedi';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const app = await createServer({
  controllers: [UserController],
  containerSetup: [
    () => {
      const adapter = createDrizzleTxAdapter(db);
      const txManager = new TxManager(adapter, { defaultNesting: 'join' });
      Container.set(TxManager, txManager);
    },
  ],
});
```

### 3. 서비스에서 @Transactional 사용

```ts
import { Service } from 'typedi';
import { Transactional, TxManager } from '@croco/tx-core';

@Service()
class UserService {
  constructor(private readonly txManager: TxManager<typeof db>) {}

  @Transactional()
  async createUser(name: string) {
    const client = this.txManager.getClient()!;
    await client.insert(users).values({ name });
  }

  @Transactional({ nesting: 'savepoint' })
  async updateUserWithSavepoint(id: string, name: string) {
    const client = this.txManager.getClient()!;
    await client.update(users).set({ name }).where(eq(users.id, id));
  }
}
```

## API

### createDrizzleTxAdapter(db)

Drizzle DB 인스턴스를 받아 `TxAdapter`를 반환합니다.

```ts
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';

const adapter = createDrizzleTxAdapter(db);
```

반환된 어댑터는 다음을 지원합니다:
- `transaction(fn, options?)`: `db.transaction` 호출
- `savepoint(client, fn, options?)`: `tx.transaction` 호출 (중첩 트랜잭션)
- `supportsSavepoint()`: 항상 `true` 반환

### 타입 유틸리티

```ts
import { InferTxClient, InferTxOptions } from '@croco/tx-drizzle';

type TxClient = InferTxClient<typeof db>;
type TxOptions = InferTxOptions<typeof db>;
```

## Dialect 지원

이 패키지는 dialect-agnostic으로 설계되어 Drizzle이 지원하는 모든 데이터베이스에서 동작합니다:
- PostgreSQL
- MySQL
- SQLite

각 dialect의 트랜잭션 옵션은 Drizzle의 타입 시그니처에서 자동으로 추론됩니다.

## Peer Dependencies

- `drizzle-orm` >=0.30.0



