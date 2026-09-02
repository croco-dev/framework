/**
 * @croco/tx-drizzle
 *
 * {@link https://github.com/croco-dev/croco-framework | GitHub Repository}
 *
 * ---
 *
 * ## Drizzle ORM Transaction Adapter
 *
 * Drizzle ORM용 `@croco/tx-core` 트랜잭션 어댑터입니다.
 * Drizzle의 `db.transaction`/`tx.transaction(savepoint)`을 `tx-core`에 연결합니다.
 *
 * @example
 * ```typescript
 * import 'reflect-metadata';
 * import { Container } from 'typedi';
 * import { TxManager } from '@croco/tx-core';
 * import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { Pool } from 'pg';
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const db = drizzle(pool);
 *
 * const adapter = createDrizzleTxAdapter(db);
 * const txManager = new TxManager(adapter, { defaultNesting: 'join' });
 * Container.set(TxManager, txManager);
 * ```
 *
 * @packageDocumentation
 */

/**
 * Drizzle DB 인스턴스를 받아 TxAdapter를 생성합니다.
 *
 * @param db - Drizzle DB 인스턴스 (PostgreSQL, MySQL, SQLite 지원)
 * @returns TxAdapter 인스턴스
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { Pool } from 'pg';
 * import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const db = drizzle(pool);
 * const adapter = createDrizzleTxAdapter(db);
 * ```
 */
export { createDrizzleTxAdapter } from "./libs/DrizzleTxAdapter";
/**
 * Row-Level Security(RLS) 사용 시 테넌트 컨텍스트가 누락된 경우 발생하는 에러입니다.
 *
 * @example
 * ```typescript
 * throw new TenantContextRequiredProblem(
 *   'tenantId',
 *   'RLS가 활성화된 테이블에 접근하려면 테넌트 컨텍스트가 필요합니다.'
 * );
 * ```
 */

export {
  RlsConfigurationProblem,
  RlsDebugLoggingProblem,
  RlsExecuteUnsupportedProblem,
  SavepointUnsupportedProblem,
  TenantContextRequiredProblem,
} from "./libs/problems/TxDrizzleProblems";
export type {
  RlsConfigurationField,
  RlsDebugLoggingPhase,
} from "./libs/problems/TxDrizzleProblems";

/**
 * Row-Level Security(RLS)를 지원하는 Drizzle 트랜잭션 어댑터를 생성합니다.
 *
 * PostgreSQL의 RLS 정책과 테넌트별 격리를 지원합니다.
 *
 * @param db - Drizzle DB 인스턴스
 * @param tenantProvider - 테넌트 ID를 제공하는 함수
 * @returns RLS를 지원하는 TxAdapter 인스턴스
 *
 * @example
 * ```typescript
 * import { createRlsTxAdapter } from '@croco/tx-drizzle';
 *
 * const adapter = createRlsTxAdapter(db, {
 *   getTenantId: () => Context.get('tenantId')
 * });
 * ```
 */

export { createRlsPolicy, type RlsPolicyOptions } from "./libs/createRlsPolicy";
export {
  createRlsTxAdapter,
  type RlsLogger,
  type RlsOptions,
  type RlsTenantProvider,
} from "./libs/RlsTxAdapter";

/**
 * Drizzle 트랜잭션 관련 타입 유틸리티입니다.
 *
 * @example
 * ```typescript
 * import { InferTxClient, InferTxOptions } from '@croco/tx-drizzle';
 *
 * type TxClient = InferTxClient<typeof db>;
 * type TxOptions = InferTxOptions<typeof db>;
 * ```
 */

export { AbstractDrizzleRepository } from "./libs/AbstractDrizzleRepository";
export { drizzleTransaction } from "./libs/DrizzleTransactionPlugin";
export type { DrizzleTransactionPluginOptions } from "./libs/DrizzleTransactionPlugin";
export type { DrizzleHealthIndicatorOptions } from "./libs/DrizzleHealthIndicator";
export { DrizzleHealthIndicator } from "./libs/DrizzleHealthIndicator";
export type {
  DrizzleCallable,
  DrizzleDb,
  DrizzleDeleteFn,
  DrizzleInsertFn,
  DrizzleSelectFn,
  DrizzleTx,
  DrizzleUpdateFn,
  InferTxClient,
  InferTxOptions,
} from "./libs/types";
