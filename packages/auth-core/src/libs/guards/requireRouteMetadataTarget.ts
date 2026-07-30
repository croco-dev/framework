import { InvalidRouteMetadataTargetProblem } from "../problems/AuthProblems";

export function requireRouteMetadataTarget(value: unknown): object {
  if ((typeof value === "object" && value !== null) || typeof value === "function") {
    return value;
  }

  throw new InvalidRouteMetadataTargetProblem(value);
}
