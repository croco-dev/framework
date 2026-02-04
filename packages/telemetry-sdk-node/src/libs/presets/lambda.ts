import type { TelemetryConfig } from '../../config';
import { ProbabilitySampler } from '../samplers/ProbabilitySampler';

type LambdaPresetOptions = {
  serviceName: string;
  serviceVersion?: string;
  probability?: number;
  exporterUrl?: string;
  exporterHeaders?: Record<string, string>;
};

function lambdaPreset(options: LambdaPresetOptions): TelemetryConfig {
  const environment = process.env.NODE_ENV ?? process.env.ENVIRONMENT ?? 'development';
  const isDevelopment = environment === 'development';

  const probability = options.probability ?? (isDevelopment ? 1.0 : 0.1);

  return {
    serviceName: options.serviceName,
    serviceVersion: options.serviceVersion,
    environment,
    enabled: process.env.TELEMETRY_ENABLED !== 'false',
    resourceAttributes: {
      'cloud.provider': 'aws',
      'cloud.platform': 'aws_lambda',
      'deployment.environment': environment,
    },
    trace: {
      enabled: true,
      exporterUrl:
        options.exporterUrl ??
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        'http://localhost:4318/v1/traces',
      exporterHeaders: {
        'X-Croco-Source': 'lambda',
        ...options.exporterHeaders,
      },
      sampler: new ProbabilitySampler({ probability }),
      batchTimeout: 3000,
      batchCount: 512,
      batchSize: 256,
    },
    metrics: {
      enabled: false,
    },
    logs: {
      enabled: false,
    },
  };
}

export { lambdaPreset };
