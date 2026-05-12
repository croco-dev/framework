import { Problem, ProblemCategory } from "@croco/problems-core";

export class ResendNotificationProblem extends Problem {
  constructor(detail: string, cause?: Error) {
    super("RESEND_NOTIFICATION_FAILED", ProblemCategory.InternalServerError, detail, {
      cause,
    });
  }
}
