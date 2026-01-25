import type { DomainEvent } from './DomainEvent';

type EventClass<T extends DomainEvent = DomainEvent> = new (...args: any[]) => T;

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
    this.events.set(eventClass.name, eventClass);
    return this;
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
    registry.register(target);
    return target;
  };
}
