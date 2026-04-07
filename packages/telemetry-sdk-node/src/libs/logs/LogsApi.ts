import type { Attributes, Context } from '@opentelemetry/api';

/**
 * Severity level for log records.
 * Follows OpenTelemetry LogRecord severity levels.
 */
export enum LogSeverity {
  TRACE = 1,
  DEBUG = 5,
  INFO = 9,
  WARN = 13,
  ERROR = 17,
  FATAL = 21,
}

/**
 * Represents a log record in the OpenTelemetry Log Data Model.
 * Structured logging interface for consistent log output.
 *
 * @example
 * ```typescript
 * logger.emit({
 *   severity: LogSeverity.INFO,
 *   body: 'User logged in',
 *   attributes: { userId: '123' }
 * });
 * ```
 */
export interface LogRecord {
  /** The timestamp when the log was emitted */
  timestamp?: number;
  /** The observed timestamp (when the event was observed) */
  observedTimestamp?: number;
  /** Severity level of the log */
  severity?: LogSeverity;
  /** Severity text (e.g., 'INFO', 'ERROR') */
  severityText?: string;
  /** The log message body */
  body: string | Record<string, unknown>;
  /** Additional attributes associated with the log */
  attributes?: Attributes;
  /** Trace context for correlation with traces */
  traceContext?: {
    traceId: string;
    spanId: string;
    traceFlags: number;
  };
}

/**
 * Options for emitting a log record.
 */
export interface LogRecordOptions {
  /** Severity level */
  severity: LogSeverity;
  /** The log message body (string or structured object) */
  body: string | Record<string, unknown>;
  /** Additional attributes */
  attributes?: Attributes;
  /** Context for trace correlation */
  context?: Context;
}

/**
 * Logger interface for structured logging.
 * Provides methods to emit logs at different severity levels.
 *
 * @example
 * ```typescript
 * const logger = TelemetryRuntime.getInstance().getLogger();
 *
 * logger.info('Application started');
 * logger.error('Failed to connect', { error: err.message });
 * logger.debug('Processing request', { requestId: 'abc123' });
 * ```
 */
export interface Logger {
  /**
   * Emits a log record.
   *
   * @param options - Log record options
   */
  emit(options: LogRecordOptions): void;

  /**
   * Logs a message at TRACE level.
   *
   * @param body - The log message or structured data
   * @param attributes - Additional attributes
   */
  trace(body: string | Record<string, unknown>, attributes?: Attributes): void;

  /**
   * Logs a message at DEBUG level.
   *
   * @param body - The log message or structured data
   * @param attributes - Additional attributes
   */
  debug(body: string | Record<string, unknown>, attributes?: Attributes): void;

  /**
   * Logs a message at INFO level.
   *
   * @param body - The log message or structured data
   * @param attributes - Additional attributes
   */
  info(body: string | Record<string, unknown>, attributes?: Attributes): void;

  /**
   * Logs a message at WARN level.
   *
   * @param body - The log message or structured data
   * @param attributes - Additional attributes
   */
  warn(body: string | Record<string, unknown>, attributes?: Attributes): void;

  /**
   * Logs a message at ERROR level.
   *
   * @param body - The log message or structured data
   * @param attributes - Additional attributes
   */
  error(body: string | Record<string, unknown>, attributes?: Attributes): void;

  /**
   * Logs a message at FATAL level.
   *
   * @param body - The log message or structured data
   * @param attributes - Additional attributes
   */
  fatal(body: string | Record<string, unknown>, attributes?: Attributes): void;
}

/**
 * Options for creating a Logger instance.
 */
export interface LoggerOptions {
  /** The name of the logger */
  name: string;
  /** Optional version of the logger */
  version?: string;
  /** Optional schema URL for the logger */
  schemaUrl?: string;
  /** Optional attributes to include with all logs */
  attributes?: Attributes;
}

/**
 * Logs API provides methods to create and use loggers.
 * This is a Croco abstraction over OpenTelemetry Logs API.
 *
 * @example
 * ```typescript
 * const logs = TelemetryRuntime.getInstance().getLogs();
 * const logger = logs.getLogger({ name: 'my-service' });
 *
 * logger.info('Service initialized');
 * ```
 */
export interface LogsApi {
  /**
   * Gets or creates a logger instance.
   *
   * @param options - Logger configuration options
   * @returns A Logger instance
   */
  getLogger(options: LoggerOptions): Logger;
}
