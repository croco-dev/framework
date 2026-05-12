import type { Attributes, Context } from "@opentelemetry/api";

/**
 * Counter is a synchronous instrument that records additive values.
 * Counters are typically used to count occurrences of an event.
 *
 * @example
 * ```typescript
 * const counter = metrics.createCounter({ name: 'requests.count' });
 * counter.add(1, { method: 'GET' });
 * ```
 */
export interface Counter {
  /**
   * Adds the given value to the current value.
   * Values are always non-negative.
   *
   * @param value - The value to add (must be non-negative)
   * @param attributes - Optional attributes to associate with this measurement
   * @param context - Optional context for the measurement
   */
  add(value: number, attributes?: Attributes, context?: Context): void;
}

/**
 * Histogram is a synchronous instrument that records the distribution of values.
 * Histograms are useful for measuring things like request latency or response sizes.
 *
 * @example
 * ```typescript
 * const histogram = metrics.createHistogram({ name: 'request.duration' });
 * histogram.record(150, { method: 'GET', status: 200 });
 * ```
 */
export interface Histogram {
  /**
   * Records a value in the histogram.
   *
   * @param value - The value to record
   * @param attributes - Optional attributes to associate with this measurement
   * @param context - Optional context for the measurement
   */
  record(value: number, attributes?: Attributes, context?: Context): void;
}

/**
 * Gauge is a synchronous instrument that records the last value it receives.
 * Gauges are useful for measuring values that can go up and down, like queue depth.
 *
 * @example
 * ```typescript
 * const gauge = metrics.createGauge({ name: 'queue.size' });
 * gauge.record(42, { queue: 'orders' });
 * ```
 */
export interface Gauge {
  /**
   * Records the current value.
   *
   * @param value - The value to record
   * @param attributes - Optional attributes to associate with this measurement
   * @param context - Optional context for the measurement
   */
  record(value: number, attributes?: Attributes, context?: Context): void;
}

/**
 * Options for creating a Counter instrument.
 */
export interface CounterOptions {
  /** The name of the counter */
  name: string;
  /** Optional description of the counter */
  description?: string;
  /** Optional unit of measurement */
  unit?: string;
}

/**
 * Options for creating a Histogram instrument.
 */
export interface HistogramOptions {
  /** The name of the histogram */
  name: string;
  /** Optional description of the histogram */
  description?: string;
  /** Optional unit of measurement */
  unit?: string;
  /** Optional explicit bucket boundaries */
  boundaries?: number[];
}

/**
 * Options for creating a Gauge instrument.
 */
export interface GaugeOptions {
  /** The name of the gauge */
  name: string;
  /** Optional description of the gauge */
  description?: string;
  /** Optional unit of measurement */
  unit?: string;
}

/**
 * Metrics API provides methods to create and use metric instruments.
 * This is a Croco abstraction over OpenTelemetry Metrics API.
 *
 * @example
 * ```typescript
 * const metrics = TelemetryRuntime.getInstance().getMetrics();
 *
 * const counter = metrics.createCounter({ name: 'requests.total' });
 * const histogram = metrics.createHistogram({ name: 'request.duration_ms' });
 * const gauge = metrics.createGauge({ name: 'active.connections' });
 * ```
 */
export interface MetricsApi {
  /**
   * Creates a new Counter instrument.
   *
   * @param options - Configuration options for the counter
   * @returns A Counter instance
   */
  createCounter(options: CounterOptions): Counter;

  /**
   * Creates a new Histogram instrument.
   *
   * @param options - Configuration options for the histogram
   * @returns A Histogram instance
   */
  createHistogram(options: HistogramOptions): Histogram;

  /**
   * Creates a new Gauge instrument.
   *
   * @param options - Configuration options for the gauge
   * @returns A Gauge instance
   */
  createGauge(options: GaugeOptions): Gauge;
}
