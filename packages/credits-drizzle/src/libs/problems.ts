import { Problem, ProblemCategory } from "@croco/problems-core";

/** Reports a redacted persistence or migration failure in the Drizzle credit adapter. */
export class CreditLedgerPersistenceProblem extends Problem {
  readonly code = "credits-drizzle/persistence-failure";
  readonly category = ProblemCategory.InternalServerError;

  constructor(operation: string, cause?: Error) {
    super(undefined, undefined, `Credit ledger persistence failed during '${operation}'.`, {
      cause,
    });
  }
}
