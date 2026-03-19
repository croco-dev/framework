import { Token } from 'typedi';

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown> | Error): void;
  child(bindings: Record<string, unknown>): ILogger;
}

export const LOGGER_TOKEN = new Token<ILogger>('ILogger');
