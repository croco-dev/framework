// Constructor dependencies must remain runtime values for emitted design:paramtypes metadata.
/* oxlint-disable typescript/consistent-type-imports */
import { ConfigService } from "@croco/framework-config";
import type { ILogger } from "@croco/framework-context";
import { Component, Context } from "@croco/framework-context";
import { trace } from "@opentelemetry/api";
import pino, { type Logger as PinoLogger } from "pino";
import { LogLevel } from "./LogLevel";
import { sanitizeLogRecord } from "./sanitizeLogRecord";
import type { LogContext } from "./types";

function isError(value: unknown): value is Error {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

@Component({ scope: "singleton" })
export class Logger implements ILogger {
  private logger: PinoLogger;

  constructor(private readonly config: ConfigService) {
    const isProduction = this.config.isProduction;
    const level = this.config.get("LOG_LEVEL") || LogLevel.INFO;

    this.logger = pino({
      level,
      transport: isProduction
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
      redact: {
        paths: [
          "password",
          "token",
          "secret",
          "*.password",
          "*.token",
          "*.secret",
          "authorization",
          "cookie",
        ],
        remove: true,
      },
      formatters: {
        log: sanitizeLogRecord,
      },
      serializers: {
        err: (error: unknown) => error,
      },
      base: isProduction ? undefined : { pid: process.pid },
    });
  }

  private static fromPino(config: ConfigService, logger: PinoLogger): Logger {
    const childLogger = Object.create(Logger.prototype) as Logger;
    return Object.assign(childLogger, { config, logger });
  }

  /**
   * Create a child logger with bound context
   */
  child(bindings: LogContext): ILogger {
    return Logger.fromPino(this.config, this.logger.child(sanitizeLogRecord(bindings)));
  }

  private getContext(): LogContext {
    const activeSpan = trace.getActiveSpan();
    const ctx = Context.get();

    const context: LogContext = {
      requestId: ctx?.requestId,
    };

    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      context.spanId = spanContext.spanId;
      context.traceId = spanContext.traceId;
    } else if (ctx?.traceId) {
      context.traceId = ctx.traceId;
    }

    return context;
  }

  private getLogContext(context?: LogContext): LogContext {
    return context ? { ...this.getContext(), ...sanitizeLogRecord(context) } : this.getContext();
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.getLogContext(context), message);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.getLogContext(context), message);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.getLogContext(context), message);
  }

  error(message: string, context?: LogContext | Error): void {
    if (isError(context)) {
      this.logger.error({ ...this.getContext(), err: context }, message);
    } else {
      this.logger.error(this.getLogContext(context), message);
    }
  }

  fatal(message: string, context?: LogContext | Error): void {
    if (isError(context)) {
      this.logger.fatal({ ...this.getContext(), err: context }, message);
    } else {
      this.logger.fatal(this.getLogContext(context), message);
    }
  }
}
