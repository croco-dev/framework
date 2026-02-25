import type { DomainEvent, EventBus } from '@croco/events-core';
import { TransactionStateProblem } from './problems/EventsTxProblems';

type TxPhase = 'active' | 'committed' | 'rolled-back';

type TxSession = {
  events: DomainEvent[];
  phase: TxPhase;
};

/**
 * @deprecated EventPublisher가 TxManager 컨텍스트를 자동으로 인식합니다.
 * EventPublisher.publish()를 직접 사용하세요.
 * 이 클래스는 향후 메이저 버전에서 제거됩니다.
 */
export class TransactionalEventPublisher {
  private readonly sessions = new Map<string, TxSession>();

  constructor(private readonly eventBus: EventBus) {}

  begin(txId: string): void {
    if (this.sessions.has(txId)) {
      throw new TransactionStateProblem(`Transaction '${txId}' already started`);
    }
    this.sessions.set(txId, { events: [], phase: 'active' });
  }

  stage(txId: string, event: DomainEvent): void {
    const session = this.requireActive(txId);
    session.events.push(event);
  }

  async commit(txId: string): Promise<void> {
    const session = this.requireActive(txId);
    session.phase = 'committed';

    const events = session.events.splice(0);
    this.sessions.delete(txId);

    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }

  rollback(txId: string): void {
    const session = this.sessions.get(txId);
    if (!session) return;
    session.phase = 'rolled-back';
    this.sessions.delete(txId);
  }

  private requireActive(txId: string): TxSession {
    const session = this.sessions.get(txId);
    if (!session) {
      throw new TransactionStateProblem(`Transaction '${txId}' not found`);
    }
    if (session.phase !== 'active') {
      throw new TransactionStateProblem(`Transaction '${txId}' is already ${session.phase}`);
    }
    return session;
  }
}
