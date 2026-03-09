import { MetadataStorage } from '@croco/framework-context';
import type { DomainEvent } from './DomainEvent';
import { DuplicateEventNameProblem, EventDefinitionProblem } from './problems/EventsProblems';

type EventClass<T extends DomainEvent = DomainEvent> = (new (
  ...args: any[]
) => T) & {
  eventName: string;
};

export const REGISTERED_EVENT_KEY = Symbol('REGISTERED_EVENT');

/**
 * 이벤트 타입 레지스트리
 * 역직렬화를 위해 이벤트 클래스를 등록하고 조회합니다.
 */
export class EventRegistry {
  private readonly events = new Map<string, EventClass>();

  /**
   * 이벤트 클래스를 등록합니다.
   * @param eventClass 등록할 이벤트 클래스
   * @returns 체이닝을 위해 this 반환
   */
  register<T extends DomainEvent>(eventClass: EventClass<T>): this {
    const eventType = this.getEventType(eventClass);

    if (this.events.has(eventType)) {
      throw new DuplicateEventNameProblem(eventType);
    }

    this.events.set(eventType, eventClass);
    return this;
  }

  static fromMetadata(eventClasses: EventClass[] = EventRegistry.getMetadataEventClasses()): EventRegistry {
    return new EventRegistry().registerMany(eventClasses);
  }

  /**
   * 이벤트 타입 이름으로 등록된 클래스를 조회합니다.
   * @param eventType 이벤트 타입 이름 (클래스 이름)
   * @returns 등록된 이벤트 클래스 또는 undefined
   */
  get<T extends DomainEvent>(eventType: string): EventClass<T> | undefined {
    return this.events.get(eventType) as EventClass<T> | undefined;
  }

  /**
   * 이벤트 타입이 등록되어 있는지 확인합니다.
   * @param eventType 이벤트 타입 이름 (클래스 이름)
   * @returns 등록 여부
   */
  has(eventType: string): boolean {
    return this.events.has(eventType);
  }

  /**
   * 등록된 모든 이벤트 타입 이름을 반환합니다.
   * @returns 이벤트 타입 이름 배열
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * 레지스트리를 초기화합니다.
   */
  clear(): void {
    this.events.clear();
  }

  private registerMany(eventClasses: EventClass[]): this {
    for (const eventClass of eventClasses) {
      this.register(eventClass);
    }

    return this;
  }

  private getEventType<T extends DomainEvent>(eventClass: EventClass<T>): string {
    if (!eventClass.eventName) {
      throw new EventDefinitionProblem();
    }

    return eventClass.eventName;
  }

  private static getMetadataEventClasses(): EventClass[] {
    return MetadataStorage.getAll<boolean>(REGISTERED_EVENT_KEY).map((entry) => entry.target as EventClass);
  }
}

/**
 * 전역 이벤트 레지스트리 인스턴스
 */
export const globalEventRegistry = new EventRegistry();

/**
 * 이벤트 클래스를 레지스트리에 자동 등록하는 데코레이터 팩토리
 * @param registry 등록에 사용할 레지스트리 (기본값: 전역 레지스트리)
 */
export function RegisterEvent(registry: EventRegistry = globalEventRegistry) {
  return <T extends DomainEvent>(target: EventClass<T>): EventClass<T> => {
    void registry;
    MetadataStorage.define(REGISTERED_EVENT_KEY, target, true);
    return target;
  };
}
