import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 컴포넌트 의존성 그래프에서 순환 참조가 발견되면 발생하는 Problem입니다.
 */
export class CircularDependencyProblem extends Problem {
  readonly code = "framework-context/circular-dependency";
  readonly category = ProblemCategory.InternalServerError;
  constructor(cycle: string[]) {
    super(undefined, undefined, `Circular dependency detected: ${cycle.join(" → ")}`);
  }
}
