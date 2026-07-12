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
