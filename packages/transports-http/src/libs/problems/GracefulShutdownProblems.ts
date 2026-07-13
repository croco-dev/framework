import { Problem, ProblemCategory } from "@croco/problems-core";

const PROBLEM_TYPE_BASE = "https://croco.dev/problems/transports-http";

export type GracefulShutdownPhase = "active-requests" | "event-bus" | "on-shutdown";

export type GracefulShutdownTimeoutOption = "eventBusDrainTimeoutMs" | "timeoutMs";

export type GracefulShutdownConfigurationProblemOptions = {
  readonly option: GracefulShutdownTimeoutOption;
  readonly receivedValue: string;
};

/** Graceful shutdown received an invalid timeout configuration. */
export class GracefulShutdownConfigurationProblem extends Problem {
  readonly option: GracefulShutdownTimeoutOption;
  readonly receivedValue: string;

  constructor(options: GracefulShutdownConfigurationProblemOptions) {
    super(
      "transports-http/graceful-shutdown-configuration",
      ProblemCategory.InternalServerError,
      `${options.option} must be a finite number; received ${options.receivedValue}`,
      {
        type: `${PROBLEM_TYPE_BASE}/graceful-shutdown-configuration`,
        extensions: options,
      },
    );
    this.option = options.option;
    this.receivedValue = options.receivedValue;
  }
}

export type GracefulShutdownTimeoutProblemOptions = {
  readonly phase: GracefulShutdownPhase;
  readonly timeoutMs: number;
  readonly elapsedMs: number;
};

/** Graceful shutdown could not complete within its bounded lifecycle. */
export class GracefulShutdownTimeoutProblem extends Problem {
  readonly phase: GracefulShutdownPhase;
  readonly timeoutMs: number;
  readonly elapsedMs: number;

  constructor(options: GracefulShutdownTimeoutProblemOptions) {
    super(
      "transports-http/graceful-shutdown-timeout",
      ProblemCategory.InternalServerError,
      `Graceful shutdown timed out during the ${options.phase} phase`,
      {
        type: `${PROBLEM_TYPE_BASE}/graceful-shutdown-timeout`,
        extensions: options,
      },
    );
    this.phase = options.phase;
    this.timeoutMs = options.timeoutMs;
    this.elapsedMs = options.elapsedMs;
  }
}
