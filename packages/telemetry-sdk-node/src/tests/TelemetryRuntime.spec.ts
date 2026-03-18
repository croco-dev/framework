import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TelemetryRuntime } from '../runtime';

describe('TelemetryRuntime', () => {
  let runtime!: TelemetryRuntime;

  beforeEach(async () => {
    await TelemetryRuntime.reset();
    runtime = TelemetryRuntime.getInstance();
  });

  it('should return singleton instance', () => {
    const instance1 = TelemetryRuntime.getInstance();
    const instance2 = TelemetryRuntime.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should return null config before initialization', () => {
    expect(runtime.getConfig()).toBeNull();
  });

  it('should initialize with valid config', async () => {
    await runtime.init({
      serviceName: 'test-service',
      enabled: false,
    });

    expect(runtime.isInitialized()).toBe(false);
  });

  it('should store config after initialization', async () => {
    const config = {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
    };

    await runtime.init({ ...config, enabled: false });
    const storedConfig = runtime.getConfig();
    expect(storedConfig).toEqual({
      ...config,
      enabled: false,
    });
  });

  it('should handle forceFlush without error', async () => {
    await runtime.forceFlush();
  });

  it('should handle shutdown without error', async () => {
    await runtime.shutdown();
  });

  it('should log warning when forceFlush fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const forceFlush = vi.fn().mockRejectedValue(new Error('flush failed'));

    Object.defineProperty(runtime, 'processor', {
      value: { forceFlush },
      configurable: true,
      writable: true,
    });

    await runtime.forceFlush();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[TelemetryRuntime] forceFlush failed: flush failed');

    warnSpy.mockRestore();
  });

  it('should prefer OTEL_EXPORTER_OTLP_TRACES_ENDPOINT over OTEL_EXPORTER_OTLP_ENDPOINT', async () => {
    const tracesEndpoint = 'http://collector:4318/v1/traces-custom';
    const genericEndpoint = 'http://collector:4318/v1/traces-generic';

    vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', tracesEndpoint);
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', genericEndpoint);

    await runtime.init({
      serviceName: 'trace-endpoint-test',
      enabled: false,
    });

    expect(runtime.getConfig()?.trace?.exporterUrl).toBeUndefined();

    vi.unstubAllEnvs();
  });

  it('should throw error when OTLP endpoint is not provided', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', '');
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');

    await expect(
      runtime.init({
        serviceName: 'test-service',
        trace: { enabled: true },
      })
    ).rejects.toThrow(
      '[TelemetryRuntime] OTLP endpoint is required. ' +
        'Set OTEL_EXPORTER_OTLP_ENDPOINT environment variable or pass endpoint in config.'
    );

    vi.unstubAllEnvs();
  });

  it('should throw error when endpoint is undefined', async () => {
    await expect(
      runtime.init({
        serviceName: 'test-service',
        trace: { enabled: true, exporterUrl: undefined },
      })
    ).rejects.toThrow(
      '[TelemetryRuntime] OTLP endpoint is required. ' +
        'Set OTEL_EXPORTER_OTLP_ENDPOINT environment variable or pass endpoint in config.'
    );
  });

  it('should not throw when endpoint is provided in config', async () => {
    await expect(
      runtime.init({
        serviceName: 'test-service',
        trace: { enabled: true, exporterUrl: 'http://localhost:4318/v1/traces' },
      })
    ).resolves.not.toThrow();
  });

  it('should not throw when endpoint is provided via env var', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318/v1/traces');

    await expect(
      runtime.init({
        serviceName: 'test-service',
        trace: { enabled: true },
      })
    ).resolves.not.toThrow();

    vi.unstubAllEnvs();
  });
});
