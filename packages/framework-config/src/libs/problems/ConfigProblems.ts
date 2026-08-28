import { Problem, ProblemCategory } from "@croco/problems-core";

export class ConfigSchemaNotFoundProblem extends Problem {
  readonly code = "framework-config/config-schema-not-found";
  readonly category = ProblemCategory.InternalServerError;
  constructor(targetName: string) {
    super(undefined, undefined, `No config schema found for '${targetName}'`);
  }
}

export class ConfigValidationProblem extends Problem {
  constructor(missingPaths: string[]) {
    const missing = missingPaths.join(", ");

    super(
      "framework-config/config-validation-failed",
      ProblemCategory.ValidationError,
      `Missing required: ${missing}`,
    );
  }
}

export class InvalidBooleanEnvProblem extends Problem {
  readonly code = "framework-config/invalid-boolean-env";
  readonly category = ProblemCategory.ValidationError;
  constructor(envName: string, value: string) {
    super(undefined, undefined, `Invalid boolean env value for '${envName}': '${value}'`);
  }
}

/** Reports a runtime env preset whose variables cross the client/server exposure boundary. */
export class RuntimeEnvPresetBoundaryProblem extends Problem {
  readonly code = "framework-config/runtime-env-preset-boundary";
  readonly category = ProblemCategory.ValidationError;
  constructor(section: "client" | "server", envName: string) {
    const requirement =
      section === "client"
        ? "client variables must use the 'NEXT_PUBLIC_' prefix"
        : "server variables cannot use the 'NEXT_PUBLIC_' prefix";

    super(undefined, undefined, `Invalid ${section} env '${envName}': ${requirement}`);
  }
}
