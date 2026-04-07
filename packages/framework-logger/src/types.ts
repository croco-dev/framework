export enum SeverityNumber {
  TRACE = 1,
  DEBUG = 5,
  INFO = 9,
  WARN = 13,
  ERROR = 17,
  FATAL = 21,
}

export type LogRecord = {
  timeUnixNano: number;
  severityNumber: SeverityNumber;
  severityText: string;
  body: string;
  attributes: Record<string, unknown>;
  resource?: Record<string, unknown>;
  instrumentationScope?: {
    name: string;
    version?: string;
  };
};

export type LogContext = {
  requestId?: string;
  spanId?: string;
  traceId?: string;
  [key: string]: unknown;
};
