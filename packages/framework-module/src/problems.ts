import { Problem, ProblemCategory } from "@croco/problems-core";
import { getModuleTokenLabel } from "./moduleTokenLabels";
import type {
  ModuleCleanupFailure,
  ModuleLifecycleExecutionOptions,
  ModuleLifecycleFailure,
  ModuleLifecyclePhase,
} from "./types/ModuleLifecycle";
import type { ModuleToken } from "./types/ModuleToken";

export type ModuleLifecycleExecutionProblem =
  | ModuleLifecycleProblem
  | ModuleLifecycleCancelledProblem
  | ModuleLifecycleDeadlineExceededProblem;

export type ModuleLifecycleInterruptionProblem =
  | ModuleLifecycleCancelledProblem
  | ModuleLifecycleDeadlineExceededProblem;

export class InvalidModuleDefinitionProblem extends Problem {
  constructor(detail: string, extensions?: Record<string, unknown>) {
    super("framework-module/invalid-module-definition", ProblemCategory.ValidationError, detail, {
      extensions,
    });
  }
}

export class ModuleDuplicateNameProblem extends Problem {
  constructor(
    moduleName: string,
    firstPath: readonly string[],
    conflictingPath: readonly string[],
  ) {
    const formatPath = (path: readonly string[]) => path.join(" → ");

    super(
      "framework-module/duplicate-module-name",
      ProblemCategory.Conflict,
      `Distinct module definitions share the name '${moduleName}': '${formatPath(firstPath)}' and '${formatPath(conflictingPath)}'.`,
      {
        extensions: { moduleName, firstPath, conflictingPath },
      },
    );
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

/** Reports a duplicate contribution identity for the same `kind:id` pair. */
export class ModuleContributionIdentityProblem extends Problem {
  constructor(kind: string, id: string, owners: readonly string[]) {
    super(
      "framework-module/contribution-identity-conflict",
      ProblemCategory.Conflict,
      `Contribution '${kind}:${id}' is declared more than once by: ${owners.join(", ")}.`,
      { extensions: { kind, id, owners } },
    );
  }
}

export class ModuleLifecycleProblem extends Problem {
  private readonly lifecycleCause: unknown;
  private readonly lifecycleModuleName: string;
  private readonly lifecyclePhase: ModuleLifecyclePhase;

  constructor(
    moduleName: string,
    phase: ModuleLifecyclePhase,
    cause: unknown,
    cleanupFailures: readonly ModuleCleanupFailure[] = [],
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    const causeOption = cause instanceof Error ? { cause } : {};

    super(
      "framework-module/lifecycle-failed",
      ProblemCategory.InternalServerError,
      `Module '${moduleName}' failed during ${phase}: ${causeMessage}`,
      {
        ...causeOption,
        extensions: {
          moduleName,
          phase,
          ...(cleanupFailures.length === 0 ? {} : { cleanupFailures }),
        },
      },
    );
    this.lifecycleCause = cause;
    this.lifecycleModuleName = moduleName;
    this.lifecyclePhase = phase;
  }

  withCleanupFailures(cleanupFailures: readonly ModuleCleanupFailure[]): ModuleLifecycleProblem {
    return new ModuleLifecycleProblem(
      this.lifecycleModuleName,
      this.lifecyclePhase,
      this.lifecycleCause,
      cleanupFailures,
    );
  }
}

/** Reports that a parent signal cancelled a module lifecycle hook. */
export class ModuleLifecycleCancelledProblem extends Problem {
  private readonly lifecycleCleanupFailures: readonly ModuleCleanupFailure[];
  private readonly lifecycleCause?: Error;
  private readonly lifecycleHookFailure?: ModuleLifecycleFailure;
  private readonly lifecycleModuleName: string;
  private readonly lifecyclePhase: ModuleLifecyclePhase;

  constructor(
    moduleName: string,
    phase: ModuleLifecyclePhase,
    cause?: Error,
    cleanupFailures: readonly ModuleCleanupFailure[] = [],
    hookFailure?: ModuleLifecycleFailure,
  ) {
    super(
      "framework-module/lifecycle-cancelled",
      ProblemCategory.InternalServerError,
      `Module '${moduleName}' was cancelled by its parent during ${phase}.`,
      {
        ...(cause ? { cause } : {}),
        extensions: {
          moduleName,
          phase,
          source: "parent",
          ...(cleanupFailures.length === 0 ? {} : { cleanupFailures }),
          ...(hookFailure ? { hookFailure } : {}),
        },
      },
    );
    this.lifecycleCleanupFailures = cleanupFailures;
    this.lifecycleCause = cause;
    this.lifecycleHookFailure = hookFailure;
    this.lifecycleModuleName = moduleName;
    this.lifecyclePhase = phase;
  }

  withCleanupFailures(
    cleanupFailures: readonly ModuleCleanupFailure[],
  ): ModuleLifecycleCancelledProblem {
    return new ModuleLifecycleCancelledProblem(
      this.lifecycleModuleName,
      this.lifecyclePhase,
      this.lifecycleCause,
      cleanupFailures,
      this.lifecycleHookFailure,
    );
  }

  withHookFailure(hookFailure: ModuleLifecycleFailure): ModuleLifecycleCancelledProblem {
    return new ModuleLifecycleCancelledProblem(
      this.lifecycleModuleName,
      this.lifecyclePhase,
      this.lifecycleCause,
      this.lifecycleCleanupFailures,
      hookFailure,
    );
  }
}

/** Reports that a module lifecycle hook exceeded its absolute deadline. */
export class ModuleLifecycleDeadlineExceededProblem extends Problem {
  private readonly lifecycleCleanupFailures: readonly ModuleCleanupFailure[];
  private readonly lifecycleDeadline: number;
  private readonly lifecycleHookFailure?: ModuleLifecycleFailure;
  private readonly lifecycleModuleName: string;
  private readonly lifecyclePhase: ModuleLifecyclePhase;

  constructor(
    moduleName: string,
    phase: ModuleLifecyclePhase,
    deadline: number,
    cleanupFailures: readonly ModuleCleanupFailure[] = [],
    hookFailure?: ModuleLifecycleFailure,
  ) {
    super(
      "framework-module/lifecycle-deadline-exceeded",
      ProblemCategory.InternalServerError,
      `Module '${moduleName}' exceeded lifecycle deadline ${deadline} during ${phase}.`,
      {
        extensions: {
          moduleName,
          phase,
          deadline,
          ...(cleanupFailures.length === 0 ? {} : { cleanupFailures }),
          ...(hookFailure ? { hookFailure } : {}),
        },
      },
    );
    this.lifecycleCleanupFailures = cleanupFailures;
    this.lifecycleDeadline = deadline;
    this.lifecycleHookFailure = hookFailure;
    this.lifecycleModuleName = moduleName;
    this.lifecyclePhase = phase;
  }

  withCleanupFailures(
    cleanupFailures: readonly ModuleCleanupFailure[],
  ): ModuleLifecycleDeadlineExceededProblem {
    return new ModuleLifecycleDeadlineExceededProblem(
      this.lifecycleModuleName,
      this.lifecyclePhase,
      this.lifecycleDeadline,
      cleanupFailures,
      this.lifecycleHookFailure,
    );
  }

  withHookFailure(hookFailure: ModuleLifecycleFailure): ModuleLifecycleDeadlineExceededProblem {
    return new ModuleLifecycleDeadlineExceededProblem(
      this.lifecycleModuleName,
      this.lifecyclePhase,
      this.lifecycleDeadline,
      this.lifecycleCleanupFailures,
      hookFailure,
    );
  }
}

export class InvalidModuleLifecycleDeadlineProblem extends Problem {
  readonly receivedValue: string;

  constructor(
    readonly operation: "initialize" | "shutdown",
    deadline: number,
  ) {
    const receivedValue = String(deadline);
    super(
      "framework-module/lifecycle-deadline-invalid",
      ProblemCategory.ValidationError,
      `Module lifecycle ${operation} deadline must be a positive safe integer Unix timestamp in milliseconds; received ${receivedValue}.`,
      {
        extensions: { operation, receivedValue },
      },
    );
    this.receivedValue = receivedValue;
  }
}

export class ModuleRegistrationConflictProblem extends Problem {
  constructor(readonly registryState: "initialized" | "initializing" | "shutting-down") {
    const recoveryAction =
      "Call shutdown() or reset() on the owning module runtime before registering modules.";

    super(
      "framework-module/registration-lifecycle-conflict",
      ProblemCategory.Conflict,
      `Module registration is unavailable while the registry is ${registryState}. ${recoveryAction}`,
      {
        extensions: { registryState, recoveryAction },
      },
    );
  }
}

export class ModuleRuntimeDisposedProblem extends Problem {
  constructor() {
    super(
      "framework-module/runtime-disposed",
      ProblemCategory.Conflict,
      "Module runtime has been disposed and cannot be reused. Create a new module runtime.",
    );
  }
}

export class ModuleRuntimeResetConflictProblem extends Problem {
  constructor(readonly runtimeState: "initializing" | "shutting-down") {
    const recoveryAction =
      "Wait for the active lifecycle operation to finish before resetting the module runtime.";

    super(
      "framework-module/runtime-reset-conflict",
      ProblemCategory.Conflict,
      `Module runtime reset is unavailable while the runtime is ${runtimeState}. ${recoveryAction}`,
      {
        extensions: { runtimeState, recoveryAction },
      },
    );
  }
}

export class ModuleRuntimeStaleContextProblem extends Problem {
  constructor() {
    super(
      "framework-module/runtime-context-stale",
      ProblemCategory.Conflict,
      "Module context belongs to a previous runtime graph. Initialize the current graph and use its context.",
    );
  }
}

export function attachModuleCleanupFailures<TProblem extends ModuleLifecycleExecutionProblem>(
  problem: TProblem,
  cleanupFailures: readonly ModuleCleanupFailure[],
): TProblem {
  if (cleanupFailures.length === 0) {
    return problem;
  }

  return problem.withCleanupFailures(cleanupFailures) as TProblem;
}

export function attachModuleLifecycleHookFailure<
  TProblem extends ModuleLifecycleInterruptionProblem,
>(problem: TProblem, hookFailure: ModuleLifecycleFailure): TProblem {
  return problem.withHookFailure(hookFailure) as TProblem;
}

export function validateModuleLifecycleExecutionOptions(
  operation: "initialize" | "shutdown",
  options: ModuleLifecycleExecutionOptions,
): void {
  if (
    options.deadline !== undefined &&
    (!Number.isSafeInteger(options.deadline) || options.deadline <= 0)
  ) {
    throw new InvalidModuleLifecycleDeadlineProblem(operation, options.deadline);
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

export class ModuleProviderUnavailableProblem extends Problem {
  constructor(moduleName: string, token: ModuleToken<unknown>, cause?: Error) {
    const provider = getModuleTokenLabel(token);

    super(
      "framework-module/provider-unavailable",
      ProblemCategory.InternalServerError,
      `Module '${moduleName}' cannot resolve provider '${provider}' from the current runtime. Bind the provider and all of its dependencies within this runtime.`,
      {
        ...(cause ? { cause } : {}),
        extensions: { moduleName, provider },
      },
    );
  }
}

export function formatModuleProviderOwnershipDetail(
  token: string,
  owners: readonly string[],
): string {
  return `Provider '${token}' has multiple module owners: ${owners.map((owner) => `'${owner}'`).join(", ")}.`;
}

export class ModuleProviderOwnershipProblem extends Problem {
  constructor(token: ModuleToken<unknown>, owners: readonly string[]) {
    const provider = getModuleTokenLabel(token);

    super(
      "framework-module/provider-ownership-conflict",
      ProblemCategory.Conflict,
      formatModuleProviderOwnershipDetail(provider, owners),
      {
        extensions: { token: provider, owners },
      },
    );
  }
}

export class ModuleProviderWriteProblem extends Problem {
  constructor(moduleName: string, token: ModuleToken<unknown>, declaredOwner?: string) {
    const provider = getModuleTokenLabel(token);
    const detail = ModuleProviderWriteProblem.createDetail(moduleName, provider, declaredOwner);

    super("framework-module/provider-write-not-owned", ProblemCategory.Conflict, detail, {
      extensions: {
        moduleName,
        token: provider,
        ...(declaredOwner ? { declaredOwner } : {}),
      },
    });
  }

  private static createDetail(
    moduleName: string,
    provider: string,
    declaredOwner?: string,
  ): string {
    if (moduleName === "<root>") {
      return `Root module context cannot write provider '${provider}'. Provider writes require ownership declared by a named module.`;
    }

    if (declaredOwner) {
      return `Module '${moduleName}' cannot write provider '${provider}' owned by module '${declaredOwner}'. Imported providers are read-only; declare a distinct token instead.`;
    }

    return `Module '${moduleName}' cannot write undeclared provider '${provider}'. Add the token to the module's providers metadata before calling ModuleContext.set().`;
  }
}
