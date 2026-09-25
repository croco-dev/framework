import { FactHistoryProblem } from "@croco/analytics-core";
import { Problem } from "@croco/problems-core";

export function persistenceFailure(cause: unknown): never {
  if (cause instanceof Problem) throw cause;
  const problem = new FactHistoryProblem("persistence-failed", "Fact history persistence failed");
  Object.defineProperty(problem, "cause", { value: cause, configurable: true });
  throw problem;
}
