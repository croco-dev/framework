import type { DomainEvent } from "./DomainEvent";
import type { EventHandler, EventHandlerClass } from "./EventHandler";

/**
 * DI 컨테이너 추상화 인터페이스
 * 앱 runtime 또는 다른 DI 경계와 통합하기 위해 사용합니다.
 */
export interface HandlerResolver {
  resolve<T extends DomainEvent>(handlerClass: EventHandlerClass<T>): EventHandler<T>;
}

/**
 * 생성자 의존성이 없는 핸들러를 직접 생성할 때 명시적으로 선택하는 리졸버입니다.
 */
export class DefaultHandlerResolver implements HandlerResolver {
  resolve<T extends DomainEvent>(handlerClass: EventHandlerClass<T>): EventHandler<T> {
    return new handlerClass();
  }
}
