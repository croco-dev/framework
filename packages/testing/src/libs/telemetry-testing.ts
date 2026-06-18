import {
  type Attributes,
  context,
  type Context as OtelContext,
  type ContextManager,
  type Exception,
  type Link,
  ROOT_CONTEXT,
  type Span,
  type SpanContext,
  type SpanOptions,
  type SpanStatus,
  TraceFlags,
  trace,
  type Tracer,
  type TracerProvider,
} from "@opentelemetry/api";
import { AsyncLocalStorage } from "node:async_hooks";
import { Problem, ProblemCategory } from "@croco/problems-core";

export type CapturedSpanEvent = {
  readonly attributes: Attributes;
  readonly name: string;
};

export type CapturedSpanException = {
  readonly exception: Exception;
};

export type CapturedSpan = {
  readonly attributes: Attributes;
  readonly endTime?: unknown;
  readonly events: CapturedSpanEvent[];
  readonly exceptions: CapturedSpanException[];
  name: string;
  readonly parentSpanId?: string;
  readonly spanId: string;
  readonly startTime?: unknown;
  status?: SpanStatus;
  ended: boolean;
  readonly traceId: string;
};

let providerInstalled = false;
let contextManagerInstalled = false;
const captureStorage = new AsyncLocalStorage<TestingTelemetryCapture>();
let defaultCapture: TestingTelemetryCapture | undefined;
let fallbackCapture: TestingTelemetryCapture | undefined;
let traceCounter = 0;
let spanCounter = 0;

class TelemetryProviderAlreadyInstalledProblem extends Problem {
  constructor() {
    super(
      "testing/telemetry-provider-already-installed",
      ProblemCategory.InternalServerError,
      "Unable to install testing telemetry capture because another OpenTelemetry tracer provider is already registered.",
      { type: "https://docs.croco.dev/problems/testing/telemetry-provider-already-installed" },
    );
  }
}

export class TestingTelemetryCapture {
  readonly spans: CapturedSpan[] = [];

  reset(): void {
    this.spans.length = 0;
  }

  async run<T>(fn: () => Promise<T> | T): Promise<T> {
    return captureStorage.run(this, async () => await fn());
  }
}

export function installTestingTelemetryCapture(): TestingTelemetryCapture {
  const capture = new TestingTelemetryCapture();

  if (!contextManagerInstalled) {
    context.setGlobalContextManager(new TestingContextManager());
    contextManagerInstalled = true;
  }

  if (!providerInstalled) {
    const installed = trace.setGlobalTracerProvider(new TestingTracerProvider());
    if (!installed) {
      throw new TelemetryProviderAlreadyInstalledProblem();
    }
    providerInstalled = true;
  }

  defaultCapture = capture;
  return capture;
}

class TestingContextManager implements ContextManager {
  private readonly storage = new AsyncLocalStorage<OtelContext>();

  active(): OtelContext {
    return this.storage.getStore() ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    ctx: OtelContext,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.storage.run(ctx, () => fn.call(thisArg, ...args));
  }

  bind<T>(ctx: OtelContext, target: T): T {
    if (typeof target !== "function") {
      return target;
    }

    const bound = ((...args: unknown[]) =>
      this.with(ctx, target as (...args: unknown[]) => T, undefined, ...args)) as T;
    return bound;
  }

  enable(): this {
    return this;
  }

  disable(): this {
    this.storage.disable();
    return this;
  }
}

class TestingTracerProvider implements TracerProvider {
  getTracer(): Tracer {
    return new TestingTracer();
  }
}

class TestingTracer implements Tracer {
  startSpan(name: string, options: SpanOptions = {}, parentContext = context.active()): Span {
    const parentSpanContext = trace.getSpanContext(parentContext);
    const record: CapturedSpan = {
      attributes: options.attributes ? { ...options.attributes } : {},
      events: [],
      exceptions: [],
      name,
      ...(parentSpanContext?.spanId ? { parentSpanId: parentSpanContext.spanId } : {}),
      spanId: nextSpanId(),
      startTime: options.startTime,
      ended: false,
      traceId: parentSpanContext?.traceId ?? nextTraceId(),
    };

    getCapture().spans.push(record);
    return new TestingSpan(record);
  }

  startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    parentContext: OtelContext,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    optionsOrFn: SpanOptions | F,
    contextOrFn?: OtelContext | F,
    fn?: F,
  ): ReturnType<F> {
    const options = typeof optionsOrFn === "function" ? {} : optionsOrFn;
    const parentContext =
      typeof optionsOrFn === "function" || typeof contextOrFn === "function"
        ? context.active()
        : contextOrFn;
    const callback = (
      typeof optionsOrFn === "function"
        ? optionsOrFn
        : typeof contextOrFn === "function"
          ? contextOrFn
          : fn
    ) as F;
    const span = this.startSpan(name, options, parentContext);
    const activeContext = trace.setSpan(parentContext ?? context.active(), span);

    return context.with(activeContext, () => callback(span)) as ReturnType<F>;
  }
}

class TestingSpan implements Span {
  constructor(private readonly record: CapturedSpan) {}

  spanContext(): SpanContext {
    return {
      spanId: this.record.spanId,
      traceFlags: TraceFlags.SAMPLED,
      traceId: this.record.traceId,
    };
  }

  setAttribute(key: string, value: NonNullable<Attributes[string]>): this {
    this.record.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: Attributes): this {
    Object.assign(this.record.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: Attributes): this {
    this.record.events.push({
      attributes: attributes ?? {},
      name,
    });
    return this;
  }

  addLink(_link: Link): this {
    return this;
  }

  addLinks(_links: Link[]): this {
    return this;
  }

  setStatus(status: SpanStatus): this {
    this.record.status = status;
    return this;
  }

  updateName(name: string): this {
    this.record.name = name;
    return this;
  }

  end(endTime?: unknown): void {
    this.record.ended = true;
    Object.assign(this.record, { endTime });
  }

  isRecording(): boolean {
    return !this.record.ended;
  }

  recordException(exception: Exception): void {
    this.record.exceptions.push({ exception });
  }
}

function getCapture(): TestingTelemetryCapture {
  const capture = captureStorage.getStore();

  if (capture) {
    return capture;
  }

  if (defaultCapture) {
    return defaultCapture;
  }

  fallbackCapture ??= new TestingTelemetryCapture();
  return fallbackCapture;
}

function nextTraceId(): string {
  traceCounter += 1;
  return traceCounter.toString(16).padStart(32, "0");
}

function nextSpanId(): string {
  spanCounter += 1;
  return spanCounter.toString(16).padStart(16, "0");
}
