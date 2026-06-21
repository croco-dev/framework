import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidSaasPresetOptionProblem extends Problem {
  readonly code = "create-croco-app/invalid-saas-preset-option";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super(undefined, undefined, detail, {
      extensions: {
        recovery:
          "Remove the unsupported SaaS option or choose a non-SaaS preset that supports it.",
      },
    });
  }
}
