import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 정책 그래프가 같은 대상에 서로 충돌하는 정책을 선언했을 때 발생하는 Problem입니다.
 */
export class PolicyConflictProblem extends Problem {
  readonly code = "framework-context/policy-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

/**
 * 정책 정의가 실행 계획으로 컴파일될 수 없는 형태일 때 발생하는 Problem입니다.
 */
export class PolicyDefinitionProblem extends Problem {
  readonly code = "framework-context/policy-definition-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

/**
 * 컴파일된 정책 실행 계획이 현재 런타임 capability로 실행될 수 없을 때 발생하는 Problem입니다.
 */
export class PolicyCapabilityProblem extends Problem {
  readonly code = "framework-context/policy-capability-unavailable";
  readonly category = ProblemCategory.Conflict;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
