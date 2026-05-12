import { Token } from "typedi";

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown> | Error): void;
  child(bindings: Record<string, unknown>): ILogger;
}

/**
 * Croco 전역 로거 인스턴스를 등록하고 조회할 때 사용하는 DI 토큰입니다.
 */
export const LOGGER_TOKEN = new Token<ILogger>("ILogger");
