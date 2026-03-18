import { bench, describe } from 'vitest';

import { lambdaPreset } from '../libs/presets/lambda';
import { TelemetryRuntime } from '../runtime';

describe('TelemetryRuntime benchmarks', () => {
  bench(
    'TelemetryRuntime.init (lambda preset)',
    async () => {
      await TelemetryRuntime.reset();

      const runtime = TelemetryRuntime.getInstance();
      await runtime.init(lambdaPreset({ serviceName: 'bench-service', probability: 0 }));

      await runtime.forceFlush();
    },
    { iterations: 10, warmupIterations: 2 }
  );

  bench(
    'lambdaPreset config creation',
    () => {
      lambdaPreset({ serviceName: 'bench-service', probability: 0 });
    },
    { iterations: 200, warmupIterations: 20 }
  );
});
