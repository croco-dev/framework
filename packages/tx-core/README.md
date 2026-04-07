# @croco/tx-core

AsyncLocalStorage 기반 트랜잭션 컨텍스트 관리(UoW)를 제공합니다.

## 설치

```bash
pnpm add @croco/tx-core
```

## 사용법

### 1. TxAdapter 구현 또는 사용

`@croco/tx-drizzle` 같은 어댑터 패키지를 사용하거나, 직접 `TxAdapter` 인터페이스를 구현합니다.

```ts
import { TxAdapter } from '@croco/tx-core';

const adapter: TxAdapter<MyClient, MyOptions> = {
  async transaction(fn, options) {
    return myDb.transaction(fn, options);
  },
  async savepoint(client, fn, options) {
    return client.transaction(fn, options);
  },
  supportsSavepoint() {
    return true;
  },
};
```

### 2. TxManager 등록

```ts
import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool);
const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join', defaultTimeout: 5000 });

Container.set(TxManager, txManager);
```

### 3. Service에서 사용

```ts
import { Component, Container } from '@croco/framework-context';
import { TxManager } from '@croco/tx-core';

@Component()
class UserService {
  async createUser(name: string) {
    const txManager = Container.get(TxManager);
    return txManager.run(async () => {
      // 트랜잭션 내에서 실행됨
    });
  }

  async updateUser(id: string, name: string) {
    const txManager = Container.get(TxManager);
    return txManager.run(async () => {
      // 중첩 호출 시 savepoint 생성
    }, { nesting: 'savepoint' });
  }

  async criticalOperation() {
    const txManager = Container.get(TxManager);
    return txManager.run(async () => {
      // 타임아웃이 있는 트랜잭션
    }, { timeout: 30000 }); // 30초 타임아웃
  }
}
```

### 4. @Transactional 데코레이터 사용

```ts
import { Component } from '@croco/framework-context';
import { Transactional } from '@croco/tx-core';

@Component()
class OrderService {
  @Transactional()
  async placeOrder(dto: CreateOrderDto) {
    // REQUIRED propagation (기본값)
  }

  @Transactional({ propagation: 'REQUIRES_NEW' })
  async createAuditLog(dto: AuditDto) {
    // 항상 새 트랜잭션
  }

  @Transactional({ propagation: 'MANDATORY' })
  async updateInventory(dto: InventoryDto) {
    // 반드시 기존 트랜잭션 내에서만 호출
  }

  @Transactional({ propagation: 'NEVER' })
  async readOnlyQuery(id: string) {
    // 트랜잭션 없이만 실행
  }

  @Transactional({ timeout: 10000 })
  async longRunningOperation() {
    // 10초 타임아웃
  }
}
```

### 5. Repository에서 현재 트랜잭션 클라이언트 사용

```ts
import { Component } from '@croco/framework-context';
import { TxManager } from '@croco/tx-core';

@Component()
class UserRepository {
  constructor(
    private readonly db: DrizzleDb,
    private readonly txManager: TxManager<typeof db>
  ) {}

  async findById(id: string) {
    const client = this.txManager.getClient() ?? this.db;
    return client.select().from(users).where(eq(users.id, id));
  }
}
```

## API

### TxAdapter<TClient, TOptions>

트랜잭션을 여는 책임을 가진 인터페이스입니다.

- `transaction(fn, options?)`: 새 트랜잭션 시작
- `savepoint(client, fn, options?)`: 중첩 트랜잭션(savepoint) 시작
- `supportsSavepoint()`: savepoint 지원 여부

### TxManager<TClient, TOptions>

AsyncLocalStorage를 사용해 트랜잭션 컨텍스트를 관리합니다.

- `run(fn, options?)`: 트랜잭션 내에서 함수 실행
- `getClient()`: 현재 트랜잭션 클라이언트 반환 (없으면 `null`)
- `isInTransaction()`: 현재 트랜잭션 내부인지 여부
- `onAfterCommit(hook)`: 트랜잭션 커밋 후 실행될 훅 등록
- `suspend(fn)`: 현재 트랜잭션 컨텍스트를 일시 중단하고 함수 실행

`onAfterCommit()`으로 등록한 훅은 root transaction commit 이후, **트랜잭션 컨텍스트 밖에서** 순차 실행됩니다. 따라서 훅 내부의 `isInTransaction()`은 `false`, `getClient()`는 `null`을 반환합니다. 훅 하나가 실패해도 나머지 훅은 계속 시도되며, 하나 이상 실패하면 `run()`은 `AfterCommitHooksProblem`으로 reject 됩니다. 즉 DB commit은 유지되지만 post-commit 작업 실패는 호출자에게 숨겨지지 않습니다.

### TxRunOptions<TOptions>

```ts
interface TxRunOptions<TOptions> {
  nesting?: 'join' | 'savepoint';
  options?: TOptions;
  timeout?: number; // 밀리초 단위 타임아웃
}
```

### TxManagerConfig

```ts
interface TxManagerConfig {
  defaultNesting?: 'join' | 'savepoint';
  defaultTimeout?: number; // 기본 타임아웃 (밀리초)
}
```

### Propagation

Spring 프레임워크와 호환되는 트랜잭션 전파 전략:

- `REQUIRED` (기본값): 기존 트랜잭션이 있으면 참여, 없으면 새로 생성
- `REQUIRES_NEW`: 항상 새 트랜잭션 생성, 기존 트랜잭션은 일시 중단
- `MANDATORY`: 반드시 기존 트랜잭션 내에서만 실행, 없으면 예외 발생
- `NEVER`: 반드시 트랜잭션 없이만 실행, 있으면 예외 발생

### TransactionalOptions<TOptions>

```ts
interface TransactionalOptions<TOptions> {
  propagation?: Propagation;
  managerKey?: string | symbol;
  nesting?: 'join' | 'savepoint';
  options?: TOptions;
  timeout?: number; // 밀리초 단위 타임아웃
}
```

### Error Types

- `TransactionTimeoutProblem`: 트랜잭션 타임아웃 발생 시
- `TxPropagationError`: 전파 규칙 위반 시
- `TransactionContextProblem`: 트랜잭션 컨텍스트 없이 onAfterCommit 호출 시
- `AfterCommitHooksProblem`: after-commit 훅 실행 실패 시

## Dependencies

- `@croco/framework-context` - DI 컨테이너 및 컴포넌트 관리
