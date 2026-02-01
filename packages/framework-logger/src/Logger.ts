import type { ConfigService } from '@croco/framework-config';
import { Component, Context } from '@croco/framework-context';
import pino, { type Logger as PinoLogger } from 'pino';
import { LogLevel } from './LogLevel';

@Component({ scope: 'singleton' })
export class Logger {
  private readonly logger: PinoLogger;

  constructor(private readonly config: ConfigService) {
    const isProduction = this.config.isProduction;
    const level = this.config.get('LOG_LEVEL') || LogLevel.INFO;

    this.logger = pino({
      level,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
      redact: {
        paths: ['password', 'token', 'secret', '*.password', '*.token', '*.secret', 'authorization', 'cookie'],
        remove: true,
      },
      base: isProduction ? undefined : { pid: process.pid },
    });
  }

  /**
   * Create a child logger with bound context
   */
  child(bindings: Record<string, any>): Logger {
    this.logger.child(bindings);
    return this;
  }

  private getContext() {
    // Automatically inject traceId, userId, tenantId from AsyncLocalStorage if available
    const ctx = Context.get();
    if (!ctx) return {};

    return {
      requestId: ctx.requestId,
      // Add other context fields if they exist in your Context definition
    };
  }

  debug(message: string, context?: Record<string, any>) {
    this.logger.debug({ ...this.getContext(), ...context }, message);
  }

  info(message: string, context?: Record<string, any>) {
    this.logger.info({ ...this.getContext(), ...context }, message);
  }

  warn(message: string, context?: Record<string, any>) {
    this.logger.warn({ ...this.getContext(), ...context }, message);
  }

  error(message: string, context?: Record<string, any> | Error) {
    if (context instanceof Error) {
      this.logger.error({ ...this.getContext(), err: context }, message);
    } else {
      this.logger.error({ ...this.getContext(), ...context }, message);
    }
  }

  fatal(message: string, context?: Record<string, any> | Error) {
    if (context instanceof Error) {
      this.logger.fatal({ ...this.getContext(), err: context }, message);
    } else {
      this.logger.fatal({ ...this.getContext(), ...context }, message);
    }
  }
}
