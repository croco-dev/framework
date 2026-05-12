import type { DomainEvent } from "./DomainEvent";
import type { EventHandler, EventHandlerClass } from "./EventHandler";

/**
 * DI 컨테이너 추상화 인터페이스
 * 외부 DI 컨테이너(TypeDI 등)와 통합하기 위해 사용합니다.
 */
export interface HandlerResolver {
  resolve<T extends DomainEvent>(handlerClass: EventHandlerClass<T>): EventHandler<T>;
}

/**
 * 기본 핸들러 리졸버
 * new 연산자로 직접 핸들러 인스턴스를 생성합니다.
 * 기존 동작과 호환됩니다.
 */
export class DefaultHandlerResolver implements HandlerResolver {
  resolve<T extends DomainEvent>(handlerClass: EventHandlerClass<T>): EventHandler<T> {
    return new handlerClass();
  }
}
