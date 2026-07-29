/**
 * 현재 트랜잭션 컨텍스트를 DI 컨테이너에서 조회할 때 사용하는 토큰입니다.
 */
export const TRANSACTION_CONTEXT_TOKEN = Symbol("TransactionContext");

export interface TransactionContext {
  isInTransaction(): boolean;
  /** Whether the active callback still accepts hooks and preserves their delivery evidence. */
  canRegisterAfterCommit(): boolean;
  onAfterCommit(hook: () => void | Promise<void>): void;
}
