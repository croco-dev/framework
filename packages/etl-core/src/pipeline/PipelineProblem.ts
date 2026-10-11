import { Problem, ProblemCategory } from "@croco/problems-core";

export type PipelineReason =
  | "invalid-definition"
  | "binding-changed"
  | "invalid-checkpoint"
  | "receipt-unresolved"
  | "interrupted"
  | "replay-unavailable"
  | "execution-fencing-required";

export class PipelineProblem extends Problem {
  readonly code = "etl-core/pipeline-failed";
  readonly category = ProblemCategory.Conflict;

  constructor(readonly reason: PipelineReason) {
    super(undefined, undefined, `Pipeline ${reason}.`, { extensions: { reason } });
  }
}
