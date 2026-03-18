import type { ConfigService } from '@croco/framework-config';
import type { ILogger } from '@croco/framework-context';
import { Component, Context } from '@croco/framework-context';
import { trace } from '@opentelemetry/api';
import pino, { type Logger as PinoLogger } from 'pino';
import { LogLevel } from './LogLevel';

@Component({ scope: 'singleton' })
export class Logger implements ILogger {
  private logger: PinoLogger;

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
  child(bindings: Record<string, unknown>): ILogger {
    const childPino = this.logger.child(bindings);
    const childLogger = new Logger(this.config);
    childLogger.logger = childPino;
    return childLogger;
  }

  private getContext() {
    const activeSpan = trace.getActiveSpan();
    const ctx = Context.get();

    const context: Record<string, unknown> = {
      requestId: ctx?.requestId,
    };

    // spanId must come from active span (Context.get() might be stale)
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      context.spanId = spanContext.spanId;
      context.traceId = spanContext.traceId;
    } else if (ctx?.traceId) {
      // If no active span, fall back to Context traceId
      context.traceId = ctx.traceId;
    }

    return context;
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.logger.debug({ ...this.getContext(), ...context }, message);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.logger.info({ ...this.getContext(), ...context }, message);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.logger.warn({ ...this.getContext(), ...context }, message);
  }

  error(message: string, context?: Record<string, unknown> | Error) {
    if (context instanceof Error) {
      this.logger.error({ ...this.getContext(), err: context }, message);
    } else {
      this.logger.error({ ...this.getContext(), ...context }, message);
    }
  }

  fatal(message: string, context?: Record<string, unknown> | Error) {
    if (context instanceof Error) {
      this.logger.fatal({ ...this.getContext(), err: context }, message);
    } else {
      this.logger.fatal({ ...this.getContext(), ...context }, message);
    }
  }
}
