import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lambdaPreset } from '../libs/presets/lambda';

describe('lambdaPreset', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.AWS_EXECUTION_ENV;
    delete process.env.NODE_ENV;
    delete process.env.ENVIRONMENT;
    delete process.env.TELEMETRY_ENABLED;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  it('should create config with required fields', () => {
    delete process.env.NODE_ENV;
    delete process.env.ENVIRONMENT;

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.serviceName).toBe('test-service');
    expect(config.environment).toBe('development');
    expect(config.enabled).toBe(true);
    expect(config.trace?.enabled).toBe(true);
  });

  it('should use custom serviceVersion', () => {
    const config = lambdaPreset({
      serviceName: 'test-service',
      serviceVersion: '2.0.0',
    });

    expect(config.serviceVersion).toBe('2.0.0');
  });

  it('should use custom probability', () => {
    const config = lambdaPreset({
      serviceName: 'test-service',
      probability: 0.25,
    });

    expect(config.trace?.probability).toBe(0.25);
  });

  it('should default probability by environment', () => {
    delete process.env.NODE_ENV;
    delete process.env.ENVIRONMENT;

    const developmentConfig = lambdaPreset({
      serviceName: 'test-service',
    });

    process.env.NODE_ENV = 'production';

    const productionConfig = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(developmentConfig.trace?.probability).toBe(1);
    expect(productionConfig.trace?.probability).toBe(0.1);
  });

  it('should use custom exporterUrl', () => {
    const config = lambdaPreset({
      serviceName: 'test-service',
      exporterUrl: 'http://custom:4318/v1/traces',
    });

    expect(config.trace?.exporterUrl).toBe('http://custom:4318/v1/traces');
  });

  it('should merge custom exporterHeaders', () => {
    const config = lambdaPreset({
      serviceName: 'test-service',
      exporterHeaders: { 'X-Custom': 'value' },
    });

    expect(config.trace?.exporterHeaders).toEqual({
      'X-Croco-Source': 'lambda',
      'X-Custom': 'value',
    });
  });

  it('should read environment from NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.environment).toBe('production');
  });

  it('should read environment from ENVIRONMENT as fallback', () => {
    delete process.env.NODE_ENV;
    process.env.ENVIRONMENT = 'staging';
    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.environment).toBe('staging');
  });

  it('should default environment to production in AWS Lambda (AWS_LAMBDA_FUNCTION_NAME)', () => {
    delete process.env.NODE_ENV;
    delete process.env.ENVIRONMENT;
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.environment).toBe('production');
  });

  it('should default environment to production in AWS Lambda (AWS_EXECUTION_ENV)', () => {
    delete process.env.NODE_ENV;
    delete process.env.ENVIRONMENT;
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.environment).toBe('production');
  });

  it('should include resource attributes', () => {
    delete process.env.NODE_ENV;
    delete process.env.ENVIRONMENT;

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.resourceAttributes).toEqual({
      'cloud.provider': 'aws',
      'cloud.platform': 'aws_lambda',
      'deployment.environment': 'development',
    });
  });

  it('should respect TELEMETRY_ENABLED=false', () => {
    process.env.TELEMETRY_ENABLED = 'false';
    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.enabled).toBe(false);
  });

  it('should have optimized batch settings for Lambda', () => {
    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.trace?.batchTimeout).toBe(3000);
    expect(config.trace?.batchCount).toBe(512);
    expect(config.trace?.batchSize).toBe(256);
  });

  it('should return undefined exporterUrl when not provided', () => {
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.trace?.exporterUrl).toBeUndefined();
  });

  it('should use OTEL_EXPORTER_OTLP_TRACES_ENDPOINT when provided', () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://traces:4318/v1/traces';

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.trace?.exporterUrl).toBe('http://traces:4318/v1/traces');
  });

  it('should use OTEL_EXPORTER_OTLP_ENDPOINT as fallback', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://generic:4318/v1/traces';

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.trace?.exporterUrl).toBe('http://generic:4318/v1/traces');
  });

  it('should prefer OTEL_EXPORTER_OTLP_TRACES_ENDPOINT over OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://traces:4318/v1/traces';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://generic:4318/v1/traces';

    const config = lambdaPreset({
      serviceName: 'test-service',
    });

    expect(config.trace?.exporterUrl).toBe('http://traces:4318/v1/traces');
  });
});
