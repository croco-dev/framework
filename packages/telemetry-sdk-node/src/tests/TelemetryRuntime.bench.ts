import { bench, describe } from "vitest";

import { lambdaPreset } from "../libs/presets/lambda";
import { TelemetryRuntime } from "../runtime";

describe("TelemetryRuntime benchmarks", () => {
  const createBenchmarkPreset = () =>
    lambdaPreset({
      serviceName: "bench-service",
      probability: 0,
      exporterUrl: "http://127.0.0.1:4318/v1/traces",
    });

  bench(
    "TelemetryRuntime.init (lambda preset)",
    async () => {
      await TelemetryRuntime.reset();

      const runtime = TelemetryRuntime.getInstance();
      await runtime.init(createBenchmarkPreset());

      await runtime.forceFlush();
    },
    { iterations: 10, warmupIterations: 2 },
  );

  bench(
    "lambdaPreset config creation",
    () => {
      createBenchmarkPreset();
    },
    { iterations: 200, warmupIterations: 20 },
  );
});
