import { Problem, ProblemCategory } from "@croco/problems-core";

export type PnpmCommandStage = "availability-check" | "dependency-install" | "lockfile-validation";

const PNPM_COMMAND_FAILURES: Record<
  PnpmCommandStage,
  { readonly code: string; readonly detail: string; readonly recovery: string }
> = {
  "availability-check": {
    code: "create-croco-app/pnpm-unavailable",
    detail: "create-croco-app requires pnpm to install generated workspace dependencies.",
    recovery: "Install pnpm or rerun with --no-install and install dependencies manually.",
  },
  "dependency-install": {
    code: "create-croco-app/dependency-install-failed",
    detail: "pnpm could not install the generated workspace dependencies.",
    recovery:
      "Resolve the pnpm installation error shown above and rerun create-croco-app, or rerun with --no-install and install dependencies manually.",
  },
  "lockfile-validation": {
    code: "create-croco-app/lockfile-validation-failed",
    detail: "pnpm could not validate the generated workspace lockfile.",
    recovery:
      "Ensure the generated manifests and pnpm-lock.yaml agree, then rerun create-croco-app, or rerun with --no-install and install dependencies manually.",
  },
};

export class PnpmCommandProblem extends Problem {
  constructor(stage: PnpmCommandStage, command: string, cause: unknown) {
    const failure = PNPM_COMMAND_FAILURES[stage];

    super(failure.code, ProblemCategory.InternalServerError, failure.detail, {
      extensions: {
        stage,
        command,
        recovery: failure.recovery,
      },
      ...(cause instanceof Error ? { cause } : {}),
    });
  }
}
