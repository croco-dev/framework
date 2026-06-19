import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 요청 파이프라인 그래프가 deterministic execution plan으로 컴파일될 수 없을 때 발생하는 Problem입니다.
 */
export class PipelineGraphProblem extends Problem {
  readonly code = "framework-context/pipeline-graph-invalid";
  readonly category = ProblemCategory.Conflict;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
