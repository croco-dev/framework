import {
  createProblemResponseDetail,
  createProblemResponseExtensions,
  extractProblemDetailsResponseExtensions,
  resolveProblemDetailsResponseRedactionPolicy,
  resolveProblemResponseRedactionPolicy,
  type Problem,
  type ProblemDetails,
} from "@croco/problems-core";

export function createHttpProblemDetails(problem: Problem, instance: string): ProblemDetails {
  const redactionPolicy = resolveProblemResponseRedactionPolicy(problem);
  const detail = createProblemResponseDetail(problem.detail, redactionPolicy);

  return {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    code: problem.code,
    instance,
    ...(detail !== undefined ? { detail } : {}),
    ...createProblemResponseExtensions(problem.extensions, redactionPolicy),
  };
}

export function redactHttpProblemDetailsBody(
  body: Record<string, unknown>,
  options: {
    readonly instance: string;
    readonly sourceProblem?: Problem;
  },
): ProblemDetails | undefined {
  if (!isProblemDetailsBody(body)) {
    return undefined;
  }

  const redactionPolicy = resolveProblemDetailsResponseRedactionPolicy(body, options.sourceProblem);
  const detail = createProblemResponseDetail(body.detail, redactionPolicy);

  return {
    type: body.type,
    title: body.title,
    status: body.status,
    code: body.code,
    instance: options.instance,
    ...(detail !== undefined ? { detail } : {}),
    ...createProblemResponseExtensions(
      extractProblemDetailsResponseExtensions(body),
      redactionPolicy,
    ),
  };
}

function isProblemDetailsBody(body: Record<string, unknown>): body is ProblemDetails {
  return (
    typeof body["type"] === "string" &&
    typeof body["title"] === "string" &&
    typeof body["status"] === "number" &&
    typeof body["code"] === "string"
  );
}
