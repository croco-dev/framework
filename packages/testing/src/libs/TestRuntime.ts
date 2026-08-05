import { Problem, ProblemCategory } from "@croco/problems-core";
import type { BackoffDependencies } from "@croco/retry-core";

export type TestDuration = number | `${number}${"ms" | "s" | "m"}`;

export type TestScheduledWork = {
  readonly dueAt: string;
  readonly id: string;
  readonly source: string;
};

export type TestReplayMetadata = {
  readonly scenarioId: string;
  readonly seed: string;
  readonly virtualTime: string;
};

export type TestRetryDependencies = Required<BackoffDependencies>;

export type TestEnvironmentOverrides = Readonly<Record<string, string | undefined>>;

export type TestRuntimeOptions = {
  readonly clock?: Date | string | TestClock;
  readonly environment?: TestEnvironmentOverrides;
  readonly ids?: string | TestIdSource;
  readonly network?: "allow" | "deny";
  readonly scenarioId?: string;
};

type ScheduledCallback = () => void | Promise<void>;

type ScheduledEntry = {
  readonly callback: ScheduledCallback;
  readonly dueAtMs: number;
  readonly id: string;
  readonly sequence: number;
  readonly source: string;
};

const MAX_DRAIN_CALLBACKS = 10_000;
const MAX_DATE_TIME_MS = 8_640_000_000_000_000;

type DrainBudget = {
  callbackCount: number;
};

export class TestKernelOutboundCallProblem extends Problem {
  constructor(host: string) {
    super(
      "testing/test-kernel-outbound-call",
      ProblemCategory.InternalServerError,
      `TestKernel blocked an outbound call to '${host}'. Register a provider fake or set network: 'allow' when this call is intentional.`,
      {
        extensions: {
          host,
          recovery: "Register a provider fake or explicitly allow this outbound call.",
        },
      },
    );
  }
}

export class TestRuntimeConfigurationProblem extends Problem {
  constructor(field: "clock" | "duration", value: string, expectation: string) {
    super(
      "testing/test-runtime-configuration",
      ProblemCategory.ValidationError,
      `Test runtime '${field}' must be ${expectation}; received '${value}'.`,
      { extensions: { expectation, field, value } },
    );
  }
}

export class TestRuntimeDrainProblem extends Problem {
  constructor(limit: number) {
    super(
      "testing/test-runtime-drain-limit",
      ProblemCategory.InternalServerError,
      `Test runtime drain exceeded ${limit} scheduled callbacks without reaching an idle state.`,
      {
        extensions: {
          limit,
          recovery:
            "Cancel the rescheduling callback or schedule its next run after the current virtual time.",
        },
      },
    );
  }
}

export class TestClock {
  private currentTimeMs: number;
  private scheduledSequence = 0;
  private readonly scheduled = new Map<string, ScheduledEntry>();

  constructor(initial: Date | string = "2026-01-01T00:00:00.000Z") {
    const time = new Date(initial).getTime();
    if (!isValidDateTime(time)) {
      throw new TestRuntimeConfigurationProblem("clock", String(initial), "a valid date");
    }
    this.currentTimeMs = time;
  }

  get now(): Date {
    return new Date(this.currentTimeMs);
  }

  get pendingWork(): readonly TestScheduledWork[] {
    return [...this.scheduled.values()]
      .sort((left, right) => left.dueAtMs - right.dueAtMs || left.sequence - right.sequence)
      .map(({ dueAtMs, id, source }) => ({ dueAt: new Date(dueAtMs).toISOString(), id, source }));
  }

  schedule(
    callback: ScheduledCallback,
    delay: TestDuration,
    source = "scheduled-work",
  ): () => void {
    const dueAtMs = nextDateTime(this.currentTimeMs, parseDuration(delay));
    const sequence = ++this.scheduledSequence;
    const id = `scheduled-${sequence}`;
    this.scheduled.set(id, {
      callback,
      dueAtMs,
      id,
      sequence,
      source,
    });
    return () => this.scheduled.delete(id);
  }

  sleep(delay: TestDuration, source = "sleep"): Promise<void> {
    return new Promise((resolve) => {
      this.schedule(resolve, delay, source);
    });
  }

  async advanceBy(duration: TestDuration): Promise<void> {
    const targetTime = nextDateTime(this.currentTimeMs, parseDuration(duration));
    await this.drainUntil(targetTime);
    this.currentTimeMs = targetTime;
  }

  async drain(): Promise<void> {
    const budget: DrainBudget = { callbackCount: 0 };
    while (this.scheduled.size > 0) {
      const next = this.nextScheduled();
      if (!next) return;
      await this.drainUntil(next.dueAtMs, budget);
    }
  }

  private async drainUntil(
    targetTime: number,
    budget: DrainBudget = { callbackCount: 0 },
  ): Promise<void> {
    while (true) {
      const next = this.nextScheduled();
      if (!next || next.dueAtMs > targetTime) return;

      budget.callbackCount += 1;
      if (budget.callbackCount > MAX_DRAIN_CALLBACKS) {
        throw new TestRuntimeDrainProblem(MAX_DRAIN_CALLBACKS);
      }

      this.scheduled.delete(next.id);
      this.currentTimeMs = next.dueAtMs;
      await next.callback();
    }
  }

  private nextScheduled(): ScheduledEntry | undefined {
    return [...this.scheduled.values()].sort(
      (left, right) => left.dueAtMs - right.dueAtMs || left.sequence - right.sequence,
    )[0];
  }
}

export class TestRandomSource {
  private state: number;

  constructor(readonly seed: string) {
    this.state = hashSeed(seed) || 1;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 0x1_0000_0000;
  }

  fork(): TestRandomSource {
    const fork = new TestRandomSource(this.seed);
    fork.state = this.state;
    return fork;
  }
}

export class TestIdSource {
  private sequence = 0;
  private randomSource: TestRandomSource;

  constructor(readonly seed: string) {
    this.randomSource = new TestRandomSource(seed);
  }

  get random(): TestRandomSource {
    return this.randomSource;
  }

  fork(): TestIdSource {
    const fork = new TestIdSource(this.seed);
    fork.sequence = this.sequence;
    fork.randomSource = this.random.fork();
    return fork;
  }

  next(prefix = "test"): string {
    this.sequence += 1;
    const entropy = Math.floor(this.random.next() * 0x1_0000_0000)
      .toString(36)
      .padStart(7, "0");
    return `${prefix}-${this.seed}-${this.sequence}-${entropy}`;
  }
}

export class TestEnvironment {
  private readonly values: Readonly<Record<string, string | undefined>>;

  constructor(overrides: TestEnvironmentOverrides = {}) {
    this.values = Object.freeze({ ...process.env, ...overrides });
  }

  get(name: string): string | undefined {
    return this.values[name];
  }

  toObject(): Readonly<Record<string, string | undefined>> {
    return { ...this.values };
  }
}

export class TestNetwork {
  constructor(private readonly mode: "allow" | "deny") {}

  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = input instanceof Request ? input.url : input.toString();
    if (this.mode === "deny") {
      let host: string;
      try {
        host = new URL(url).host;
      } catch {
        throw new TestKernelOutboundCallProblem(url);
      }
      throw new TestKernelOutboundCallProblem(host);
    }
    return fetch(input, init);
  }
}

export class TestRuntime {
  readonly clock: TestClock;
  readonly environment: TestEnvironment;
  readonly ids: TestIdSource;
  readonly network: TestNetwork;
  readonly random: TestRandomSource;
  readonly scenarioId: string;

  constructor(options: TestRuntimeOptions = {}) {
    this.ids =
      typeof options.ids === "string"
        ? new TestIdSource(options.ids)
        : options.ids
          ? options.ids
          : new TestIdSource(crypto.randomUUID());
    this.clock =
      options.clock instanceof TestClock
        ? new TestClock(options.clock.now)
        : new TestClock(options.clock);
    this.environment = new TestEnvironment(options.environment);
    this.network = new TestNetwork(options.network ?? "deny");
    this.random = this.ids.random;
    this.scenarioId = options.scenarioId ?? this.ids.next("scenario");
  }

  get replay(): TestReplayMetadata {
    return Object.freeze({
      scenarioId: this.scenarioId,
      seed: this.ids.seed,
      virtualTime: this.clock.now.toISOString(),
    });
  }

  get retry(): TestRetryDependencies {
    return {
      random: () => this.random.next(),
      sleep: (delayMs: number, signal?: AbortSignal) => sleepForRetry(this.clock, delayMs, signal),
      sleepSupportsAbortSignal: true,
    };
  }
}

function sleepForRetry(clock: TestClock, delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise((resolve, reject) => {
    let cancel = (): void => undefined;
    const cleanup = (): void => signal?.removeEventListener("abort", onAbort);
    const onAbort = (): void => {
      cancel();
      cleanup();
      reject(signal?.reason);
    };
    cancel = clock.schedule(
      () => {
        cleanup();
        resolve();
      },
      delayMs,
      "retry:backoff",
    );

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
    }
  });
}

export function fixedClock(initial: Date | string): TestClock {
  return new TestClock(initial);
}

export function seededIds(seed: string): TestIdSource {
  return new TestIdSource(seed);
}

function parseDuration(value: TestDuration): number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TestRuntimeConfigurationProblem(
        "duration",
        String(value),
        "a non-negative safe integer",
      );
    }
    return value;
  }

  const match = /^(\d+)(ms|s|m)$/.exec(value);
  if (!match) {
    throw new TestRuntimeConfigurationProblem("duration", String(value), "an ms, s, or m duration");
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1;
  const duration = amount * multiplier;
  if (!Number.isSafeInteger(duration)) {
    throw new TestRuntimeConfigurationProblem(
      "duration",
      String(value),
      "a non-negative safe integer duration",
    );
  }
  return duration;
}

function nextDateTime(currentTimeMs: number, duration: number): number {
  const nextTimeMs = currentTimeMs + duration;
  if (!isValidDateTime(nextTimeMs)) {
    throw new TestRuntimeConfigurationProblem(
      "duration",
      String(duration),
      "a duration that keeps virtual time within the valid Date range",
    );
  }
  return nextTimeMs;
}

function isValidDateTime(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= MAX_DATE_TIME_MS;
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
