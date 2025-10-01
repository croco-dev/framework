export abstract class DomainEvent {
  public readonly eventName: string;
  public readonly timestamp: Date;

  constructor() {
    this.eventName = this.constructor.name;
    this.timestamp = new Date();
  }
}
