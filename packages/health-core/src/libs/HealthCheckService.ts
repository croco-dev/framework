import {
  DuplicateHealthIndicatorProblem,
  InvalidHealthIndicatorIdProblem,
  InvalidHealthCheckTimeoutProblem,
  MAX_HEALTH_CHECK_TIMEOUT_MS,
} from "./problems/HealthProblems";
import type {
  HealthIndicatorIdentityKind,
  HealthIndicatorNamespace,
} from "./problems/HealthProblems";
import type {
  HealthIndicator,
  HealthIndicatorResult,
  HealthStatus,
  ReadinessIndicator,
} from "./HealthIndicator";

export type HealthCheckResult = {
  status: HealthStatus;
  results: HealthIndicatorResult[];
};

export type HealthCheckServiceOptions = {
  /**
   * Timeout in milliseconds. Must be an integer from 1 through 2,147,483,647.
   * Invalid values throw an InvalidHealthCheckTimeoutProblem during service setup or indicator
   * registration.
   */
  timeout?: number;
};

/** Idempotent handle that removes one registered health indicator from future reports. */
export interface HealthIndicatorRegistration {
  dispose(): void;
}

const DEFAULT_TIMEOUT = 5000;

function assertValidTimeout(timeout: number, source: "default" | "indicator"): void {
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_HEALTH_CHECK_TIMEOUT_MS) {
    throw new InvalidHealthCheckTimeoutProblem(source, timeout);
  }
}

type RegisteredIndicator<TIndicator extends HealthIndicator> = {
  readonly id?: string;
  readonly indicator: TIndicator;
  readonly timeout?: number;
};

export class HealthCheckService {
  private readonly healthIndicators = new Set<RegisteredIndicator<HealthIndicator>>();
  private readonly readinessIndicators = new Set<RegisteredIndicator<ReadinessIndicator>>();
  private readonly healthIndicatorIdentities = new Map<
    string,
    RegisteredIndicator<HealthIndicator>
  >();
  private readonly readinessIndicatorIdentities = new Map<
    string,
    RegisteredIndicator<ReadinessIndicator>
  >();
  private readonly healthIndicatorInstances = new Map<
    HealthIndicator,
    RegisteredIndicator<HealthIndicator>
  >();
  private readonly readinessIndicatorInstances = new Map<
    ReadinessIndicator,
    RegisteredIndicator<ReadinessIndicator>
  >();
  private readonly timeout: number;

  constructor(options: HealthCheckServiceOptions = {}) {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    assertValidTimeout(timeout, "default");
    this.timeout = timeout;
  }

  /**
   * Registers a health indicator under a stable component ID.
   *
   * The ID replaces the indicator-returned name in reports. Duplicate IDs are rejected within the
   * health namespace. Disposing the returned handle removes only this registration.
   */
  register(
    id: string,
    indicator: HealthIndicator,
    options?: HealthCheckServiceOptions,
  ): HealthIndicatorRegistration;
  /**
   * @deprecated Pass an explicit indicator ID as the first argument. Repeated inferred names or
   * indicator references are rejected within the health namespace.
   */
  register(
    indicator: HealthIndicator,
    options?: HealthCheckServiceOptions,
  ): HealthIndicatorRegistration;
  register(
    idOrIndicator: string | HealthIndicator,
    indicatorOrOptions: HealthIndicator | HealthCheckServiceOptions = {},
    options: HealthCheckServiceOptions = {},
  ): HealthIndicatorRegistration {
    if (typeof idOrIndicator === "string") {
      return this.registerExplicitIndicator(
        "health",
        idOrIndicator,
        indicatorOrOptions as HealthIndicator,
        options,
        this.healthIndicators,
        this.healthIndicatorIdentities,
        this.healthIndicatorInstances,
      );
    }

    return this.registerLegacyIndicator(
      "health",
      idOrIndicator,
      indicatorOrOptions as HealthCheckServiceOptions,
      this.healthIndicators,
      this.healthIndicatorIdentities,
      this.healthIndicatorInstances,
    );
  }

  /**
   * Registers a readiness indicator under a stable component ID.
   *
   * The ID replaces the indicator-returned name in reports. Duplicate IDs are rejected within the
   * readiness namespace. A health indicator may use the same ID because the namespaces are separate.
   */
  registerReadiness(
    id: string,
    indicator: ReadinessIndicator,
    options?: HealthCheckServiceOptions,
  ): HealthIndicatorRegistration;
  /**
   * @deprecated Pass an explicit indicator ID as the first argument. Repeated inferred names or
   * indicator references are rejected within the readiness namespace.
   */
  registerReadiness(
    indicator: ReadinessIndicator,
    options?: HealthCheckServiceOptions,
  ): HealthIndicatorRegistration;
  registerReadiness(
    idOrIndicator: string | ReadinessIndicator,
    indicatorOrOptions: ReadinessIndicator | HealthCheckServiceOptions = {},
    options: HealthCheckServiceOptions = {},
  ): HealthIndicatorRegistration {
    if (typeof idOrIndicator === "string") {
      return this.registerExplicitIndicator(
        "readiness",
        idOrIndicator,
        indicatorOrOptions as ReadinessIndicator,
        options,
        this.readinessIndicators,
        this.readinessIndicatorIdentities,
        this.readinessIndicatorInstances,
      );
    }

    return this.registerLegacyIndicator(
      "readiness",
      idOrIndicator,
      indicatorOrOptions as HealthCheckServiceOptions,
      this.readinessIndicators,
      this.readinessIndicatorIdentities,
      this.readinessIndicatorInstances,
    );
  }

  isLive(): boolean {
    return true;
  }

  async isReady(): Promise<boolean> {
    const result = await this.checkReadiness();
    return result.status === "up";
  }

  async check(): Promise<HealthCheckResult> {
    return this.checkIndicators(this.healthIndicators, "check");
  }

  async checkReadiness(): Promise<HealthCheckResult> {
    return this.checkIndicators(this.readinessIndicators, "isReady");
  }

  private async checkIndicators(
    indicators: ReadonlySet<RegisteredIndicator<HealthIndicator | ReadinessIndicator>>,
    method: "check" | "isReady",
  ): Promise<HealthCheckResult> {
    const results = await Promise.all(
      Array.from(indicators, (registration) => this.checkWithTimeout(registration, method)),
    );

    const status = results.every((r) => r.status === "up") ? "up" : "down";

    return { status, results };
  }

  private async checkWithTimeout(
    registration: RegisteredIndicator<HealthIndicator | ReadinessIndicator>,
    method: "check" | "isReady",
  ): Promise<HealthIndicatorResult> {
    const { id, indicator, timeout: timeoutOverride } = registration;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = timeoutOverride ?? this.timeout;

    const timeoutPromise = new Promise<HealthIndicatorResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Health check timeout for ${id ?? getIndicatorName(indicator)}`));
      }, timeout);
    });

    try {
      const checkFn =
        method === "isReady" && "isReady" in indicator
          ? indicator.isReady.bind(indicator)
          : indicator.check.bind(indicator);
      const result = await Promise.race([checkFn(controller.signal), timeoutPromise]);
      return id === undefined ? result : { ...result, name: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        name: id ?? getIndicatorName(indicator),
        status: "down",
        details: { error: message },
      };
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  private registerExplicitIndicator<TIndicator extends HealthIndicator>(
    namespace: HealthIndicatorNamespace,
    id: string,
    indicator: TIndicator,
    options: HealthCheckServiceOptions,
    registrations: Set<RegisteredIndicator<TIndicator>>,
    registrationsByIdentity: Map<string, RegisteredIndicator<TIndicator>>,
    registrationsByIndicator: Map<TIndicator, RegisteredIndicator<TIndicator>>,
  ): HealthIndicatorRegistration {
    assertValidIndicatorId(namespace, id);
    const timeout = validatedIndicatorTimeout(options);

    if (registrationsByIdentity.has(id)) {
      throw new DuplicateHealthIndicatorProblem(namespace, id);
    }
    if (registrationsByIndicator.has(indicator)) {
      throw new DuplicateHealthIndicatorProblem(namespace, undefined, "indicator-reference");
    }

    const registration = { id, indicator, timeout };
    registrations.add(registration);
    registrationsByIdentity.set(id, registration);
    registrationsByIndicator.set(indicator, registration);

    return createRegistrationHandle(() => {
      if (registrationsByIdentity.get(id) !== registration) {
        return;
      }
      registrationsByIdentity.delete(id);
      registrationsByIndicator.delete(indicator);
      registrations.delete(registration);
    });
  }

  private registerLegacyIndicator<TIndicator extends HealthIndicator>(
    namespace: HealthIndicatorNamespace,
    indicator: TIndicator,
    options: HealthCheckServiceOptions,
    registrations: Set<RegisteredIndicator<TIndicator>>,
    registrationsByIdentity: Map<string, RegisteredIndicator<TIndicator>>,
    registrationsByIndicator: Map<TIndicator, RegisteredIndicator<TIndicator>>,
  ): HealthIndicatorRegistration {
    const identity = indicator.name;
    if (identity !== undefined) {
      assertValidIndicatorId(namespace, identity, "inferred-name");
    }
    const registration = { indicator, timeout: validatedIndicatorTimeout(options) };

    if (identity !== undefined && registrationsByIdentity.has(identity)) {
      throw new DuplicateHealthIndicatorProblem(namespace, identity, "inferred-name");
    }
    if (registrationsByIndicator.has(indicator)) {
      throw new DuplicateHealthIndicatorProblem(namespace, undefined, "indicator-reference");
    }

    registrations.add(registration);
    if (identity !== undefined) {
      registrationsByIdentity.set(identity, registration);
    }
    registrationsByIndicator.set(indicator, registration);

    return createRegistrationHandle(() => {
      if (identity !== undefined && registrationsByIdentity.get(identity) === registration) {
        registrationsByIdentity.delete(identity);
      }
      if (registrationsByIndicator.get(indicator) === registration) {
        registrationsByIndicator.delete(indicator);
      }
      registrations.delete(registration);
    });
  }
}

function assertValidIndicatorId(
  namespace: HealthIndicatorNamespace,
  id: string,
  identityKind: Exclude<HealthIndicatorIdentityKind, "indicator-reference"> = "explicit-id",
): void {
  if (id.length === 0 || id.trim() !== id) {
    throw new InvalidHealthIndicatorIdProblem(namespace, id, identityKind);
  }
}

function validatedIndicatorTimeout(options: HealthCheckServiceOptions): number | undefined {
  const timeout = options.timeout;
  if (timeout !== undefined) {
    assertValidTimeout(timeout, "indicator");
  }
  return timeout;
}

function createRegistrationHandle(dispose: () => void): HealthIndicatorRegistration {
  return { dispose };
}

function getIndicatorName(indicator: HealthIndicator | ReadinessIndicator): string {
  return indicator.name ?? indicator.constructor.name;
}
