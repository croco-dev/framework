import type { Constructor } from '../types';

/**
 * 실행 컨텍스트 - Guard, Interceptor, Filter에서 사용
 * NestJS의 ExecutionContext를 참고하되 Croco에 맞게 단순화
 */
export interface ExecutionContext {
  /** 원본 HTTP Request 객체 */
  getRequest(): Request;

  /** 컨트롤러 클래스 참조 */
  getClass(): Constructor;

  /** 핸들러 메서드 이름 */
  getHandler(): string | symbol;

  /** 요청 URL 경로 */
  getPath(): string;

  /** HTTP 메서드 (GET, POST 등) */
  getMethod(): string;
}
