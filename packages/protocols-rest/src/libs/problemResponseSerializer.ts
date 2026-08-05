import {
  createProblemResponseDetail,
  createProblemResponseExtensions,
  extractProblemDetailsResponseExtensions,
  resolveProblemDetailsResponseRedactionPolicy,
  resolveProblemResponseRedactionPolicy,
  type Problem,
  type ProblemDetails,
} from "@croco/problems-core";

/**
 * Creates a public HTTP Problem Details payload with registry redaction and a query-free instance.
 */
export function createHttpProblemDetails(problem: Problem, instance?: string): ProblemDetails {
  const redactionPolicy = resolveProblemResponseRedactionPolicy(problem);
  const detail = createProblemResponseDetail(problem.detail, redactionPolicy);
  const responseInstance = createPublicProblemInstance(instance ?? problem.instance);

  return {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    code: problem.code,
    ...(responseInstance !== undefined ? { instance: responseInstance } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...createProblemResponseExtensions(problem.extensions, redactionPolicy),
  };
}

/**
 * Redacts a validated HTTP Problem Details body while preserving its stable public fields.
 */
export function redactHttpProblemDetailsBody(
  body: Record<string, unknown>,
  options: {
    readonly instance?: string;
    readonly sourceProblem?: Problem;
  } = {},
): ProblemDetails | undefined {
  if (!isProblemDetailsBody(body)) {
    return undefined;
  }

  const redactionPolicy = resolveProblemDetailsResponseRedactionPolicy(body, options.sourceProblem);
  const detail = createProblemResponseDetail(body.detail, redactionPolicy);
  const responseInstance = createPublicProblemInstance(
    options.instance ?? (typeof body.instance === "string" ? body.instance : undefined),
  );

  return {
    type: body.type,
    title: body.title,
    status: body.status,
    code: body.code,
    ...(responseInstance !== undefined ? { instance: responseInstance } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...createProblemResponseExtensions(
      extractProblemDetailsResponseExtensions(body),
      redactionPolicy,
    ),
  };
}

function createPublicProblemInstance(instance: string | undefined): string | undefined {
  if (instance === undefined) {
    return undefined;
  }

  const queryIndex = instance.indexOf("?");
  const fragmentIndex = instance.indexOf("#");
  const delimiterIndexes = [queryIndex, fragmentIndex].filter((index) => index >= 0);

  if (delimiterIndexes.length === 0) {
    return instance;
  }

  return instance.slice(0, Math.min(...delimiterIndexes));
}

function isProblemDetailsBody(body: Record<string, unknown>): body is ProblemDetails {
  return (
    typeof body["type"] === "string" &&
    typeof body["title"] === "string" &&
    typeof body["status"] === "number" &&
    typeof body["code"] === "string"
  );
}
