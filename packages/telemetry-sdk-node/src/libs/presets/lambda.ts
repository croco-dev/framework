import type { TelemetryConfig } from '../../config';

type LambdaPresetOptions = {
  serviceName: string;
  serviceVersion?: string;
  probability?: number;
  exporterUrl?: string;
  exporterHeaders?: Record<string, string>;
};

function lambdaPreset(options: LambdaPresetOptions): TelemetryConfig {
  const configuredEnvironment = process.env.NODE_ENV ?? process.env.ENVIRONMENT;
  const isLambdaEnvironment =
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
    process.env.AWS_EXECUTION_ENV?.includes('AWS_Lambda') === true;

  const environment = configuredEnvironment ?? (isLambdaEnvironment ? 'production' : 'development');
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
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      exporterHeaders: {
        'X-Croco-Source': 'lambda',
        ...options.exporterHeaders,
      },
      probability,
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
