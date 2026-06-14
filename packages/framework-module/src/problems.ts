import { Problem, ProblemCategory } from "@croco/problems-core";
import { getModuleTokenLabel } from "./moduleTokenLabels";
import type { ModuleToken } from "./types/ModuleToken";

type ModuleLifecyclePhase = "setup" | "start" | "shutdown";

export class InvalidModuleDefinitionProblem extends Problem {
  constructor(detail: string, extensions?: Record<string, unknown>) {
    super("framework-module/invalid-module-definition", ProblemCategory.ValidationError, detail, {
      extensions,
    });
  }
}

export class ModuleCircularDependencyProblem extends Problem {
  constructor(cycle: readonly string[]) {
    const path = cycle.join(" → ");

    super(
      "framework-module/circular-dependency",
      ProblemCategory.InternalServerError,
      `Circular dependency detected: ${path}`,
      {
        extensions: { cycle },
      },
    );
  }
}

export class ModuleLifecycleProblem extends Problem {
  constructor(moduleName: string, phase: ModuleLifecyclePhase, cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    const causeOption = cause instanceof Error ? { cause } : {};

    super(
      "framework-module/lifecycle-failed",
      ProblemCategory.InternalServerError,
      `Module '${moduleName}' failed during ${phase}: ${causeMessage}`,
      {
        ...causeOption,
        extensions: { moduleName, phase },
      },
    );
  }
}

export class ModuleProviderVisibilityProblem extends Problem {
  constructor(moduleName: string, token: ModuleToken<unknown>) {
    const provider = getModuleTokenLabel(token);

    super(
      "framework-module/provider-not-visible",
      ProblemCategory.InternalServerError,
      `Module '${moduleName}' cannot access provider '${provider}'. Export it from an imported module or register it locally.`,
      {
        extensions: { moduleName, provider },
      },
    );
  }
}
