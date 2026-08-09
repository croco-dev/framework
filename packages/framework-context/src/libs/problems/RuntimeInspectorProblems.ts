import { Problem, ProblemCategory } from "@croco/problems-core";

export type RuntimeInspectorNumericOption =
  | "maxRequests"
  | "maxEventsPerRequest"
  | "maxStringLength";

/** Runtime inspector limits must preserve finite, bounded collection semantics. */
export class RuntimeInspectorConfigurationProblem extends Problem {
  readonly code = "framework-context/runtime-inspector-invalid-configuration";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    readonly option: RuntimeInspectorNumericOption,
    readonly value: number,
  ) {
    super(
      undefined,
      undefined,
      `Invalid RuntimeInspector configuration: ${option} must be a positive safe integer; received ${value}`,
    );
  }
}
