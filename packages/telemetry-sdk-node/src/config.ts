import type { Sampler } from '@opentelemetry/sdk-trace-base';

export type TelemetryConfig = {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  enabled?: boolean;
  trace?: TraceConfig;
  metrics?: MetricsConfig;
  logs?: LogsConfig;
  resourceAttributes?: Record<string, string | number | boolean>;
};

export type TraceConfig = {
  enabled?: boolean;
  exporterUrl?: string;
  exporterHeaders?: Record<string, string>;
  sampler?: Sampler;
  batchTimeout?: number;
  batchCount?: number;
  batchSize?: number;
  instrumentations?: Array<never>;
};

export type MetricsConfig = {
  enabled?: boolean;
  exporterUrl?: string;
  exporterHeaders?: Record<string, string>;
  exportIntervalMillis?: number;
  exportTimeoutMillis?: number;
};

export type LogsConfig = {
  enabled?: boolean;
};
