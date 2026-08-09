import { Problem, ProblemCategory } from "@croco/problems-core";

const PROBLEM_TYPE_BASE = "https://croco.dev/problems/transports-http";

export type DiagnosticsLimitOption = "messageLimit" | "recentErrorLimit";

export type DiagnosticsConfigurationProblemOptions = {
  readonly option: DiagnosticsLimitOption;
  readonly receivedValue: string;
};

/** Operational diagnostics received an invalid response-size limit. */
export class DiagnosticsConfigurationProblem extends Problem {
  readonly option: DiagnosticsLimitOption;
  readonly receivedValue: string;

  constructor(options: DiagnosticsConfigurationProblemOptions) {
    const requirement =
      options.option === "recentErrorLimit"
        ? "a finite nonnegative safe integer"
        : "a finite positive safe integer";
    super(
      "transports-http/diagnostics-invalid-configuration",
      ProblemCategory.InternalServerError,
      `diagnostics.${options.option} must be ${requirement}; received ${options.receivedValue}`,
      {
        type: `${PROBLEM_TYPE_BASE}/diagnostics-invalid-configuration`,
        extensions: options,
      },
    );
    this.option = options.option;
    this.receivedValue = options.receivedValue;
  }
}
