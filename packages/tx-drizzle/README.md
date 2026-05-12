# @croco/tx-drizzle

Drizzle ORM용 `@croco/tx-core` 트랜잭션 어댑터입니다. Drizzle의 `db.transaction`/`tx.transaction(savepoint)`을 `tx-core`에 연결합니다.

## 설치

```bash
pnpm add @croco/tx-drizzle @croco/tx-core drizzle-orm typedi
```

## 사용법

### 1. Drizzle DB 생성 및 어댑터 연결

```ts
import "reflect-metadata";
import { Container } from "typedi";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: "join" });

Container.set(TxManager, txManager);
```

### 2. TxManager 등록

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
      const adapter = createDrizzleTxAdapter(db);
      const txManager = new TxManager(adapter, { defaultNesting: 'join' });
      Container.set(TxManager, txManager);
    },
  ],
});
```

### 3. 서비스에서 @Transactional 사용

```ts
import { Service } from "typedi";
import { Transactional, TxManager } from "@croco/tx-core";

@Service()
class UserService {
  constructor(private readonly txManager: TxManager<typeof db>) {}

  @Transactional()
  async createUser(name: string) {
    const client = this.txManager.getClient()!;
    await client.insert(users).values({ name });
  }

  @Transactional({ nesting: "savepoint" })
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
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";

const adapter = createDrizzleTxAdapter(db);
```

반환된 어댑터는 다음을 지원합니다:

- `transaction(fn, options?)`: `db.transaction` 호출
- `savepoint(client, fn, options?)`: `tx.transaction` 호출 (중첩 트랜잭션). 런타임 transaction client가 `transaction()`을 제공하지 않으면 `SavepointUnsupportedProblem`으로 즉시 실패
- `supportsSavepoint()`: `true` 반환. 단, 실제 중첩 트랜잭션 실행은 런타임 transaction client의 `transaction()` 지원이 필요

### 타입 유틸리티

```ts
import { InferTxClient, InferTxOptions } from "@croco/tx-drizzle";

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
