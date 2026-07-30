import { Problem, ProblemCategory } from "@croco/problems-core";

export class MeteringTransitionProblem extends Problem {
  constructor(transition: string, reason: string, idempotencyKey: string) {
    super(
      "metering/transition-conflict",
      ProblemCategory.Conflict,
      `Metering transition '${transition}' failed: ${reason}`,
      {
        extensions: {
          idempotencyKey,
          reason,
          transition,
        },
      },
    );
  }
}
