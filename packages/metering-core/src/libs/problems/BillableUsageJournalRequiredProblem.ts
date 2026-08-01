import { Problem, ProblemCategory } from "@croco/problems-core";

export class BillableUsageJournalRequiredProblem extends Problem {
  constructor(meterId: string) {
    super(
      "metering/billable-usage-journal-required",
      ProblemCategory.InternalServerError,
      `Billable meter '${meterId}' requires a persistent BillableUsageJournal`,
      { extensions: { meterId } },
    );
  }
}
