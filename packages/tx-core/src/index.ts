/**
 * 트랜잭션 매니저 등록과 전파 규칙 위반 시 사용하는 에러 타입입니다.
 */
export {
  DuplicateTxManagerRegistrationProblem,
  TxManagerNotRegisteredError,
  TxPropagationError,
} from './libs/errors';

/**
 * 트랜잭션 데코레이터 오용, 컨텍스트 누락, 타임아웃 상황을 나타내는 Problem 타입입니다.
 */
export {
  AfterCommitHooksProblem,
  TransactionContextProblem,
  TransactionDecoratorProblem,
  TransactionTimeoutProblem,
} from './libs/problems/TransactionProblems';

/**
 * 메서드에 트랜잭션 전파 규칙과 중첩 전략을 적용하는 데코레이터입니다.
 */
export { Transactional } from './libs/Transactional';

/**
 * 루트 트랜잭션과 savepoint 생성을 추상화하는 어댑터 계약입니다.
 */
export type { TxAdapter } from './libs/TxAdapter';

/**
 * AsyncLocalStorage 기반으로 현재 트랜잭션 컨텍스트를 관리하는 매니저입니다.
 */
export { TxManager } from './libs/TxManager';

/**
 * 키 기반으로 트랜잭션 매니저를 등록하고 조회하는 레지스트리입니다.
 */
export { TxManagerRegistry } from './libs/TxManagerRegistry';

/**
 * 트랜잭션 훅과 실행 옵션, 전파 규칙을 설명하는 공개 타입 모음입니다.
 */
export type {
  AfterCommitHook,
  NestingStrategy,
  Propagation,
  TransactionalOptions,
  TxManagerConfig,
  TxManagerKey,
  TxRunOptions,
} from './libs/types';

/**
 * 기본 트랜잭션 매니저를 등록할 때 사용하는 레지스트리 키입니다.
 */
export { DEFAULT_TX_MANAGER_KEY } from './libs/types';
