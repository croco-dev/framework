import type { DomainEvent } from './DomainEvent';

export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public getDomainEvents(): ReadonlyArray<DomainEvent> {
    return [...this.domainEvents];
  }

  public pullDomainEvents(): ReadonlyArray<DomainEvent> {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  public clearDomainEvents(): void {
    this.domainEvents = [];
  }

  public hasDomainEvents(): boolean {
    return this.domainEvents.length > 0;
  }
}
