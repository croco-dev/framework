import { Problem, ProblemCategory } from "@croco/problems-core";

export type ProblemDetails<Code extends string = string, Status extends number = number> = {
  readonly type: string;
  readonly title: string;
  readonly status: Status;
  readonly detail?: string;
  readonly instance?: string;
  readonly code: Code;
} & Record<string, unknown>;

export type ProblemDeclaration<
  Code extends string = string,
  Category extends string = string,
  Status extends number = number,
> = {
  readonly code: Code;
  readonly category: Category;
  readonly status: Status;
  readonly description?: string;
  readonly type?: string;
  readonly cookbookPath?: string;
};

export type ProblemDetailsFor<Problem extends ProblemDeclaration> =
  Problem extends ProblemDeclaration ? ProblemDetails<Problem["code"], Problem["status"]> : never;

export type ProblemClientSuccess<T> = {
  readonly ok: true;
  readonly data: T;
  readonly response: Response;
};

export type ProblemClientProblemFailure<Problem extends ProblemDeclaration> =
  Problem extends ProblemDeclaration
    ? {
        readonly ok: false;
        readonly kind: "problem";
        readonly code: Problem["code"];
        readonly category: Problem["category"];
        readonly status: Problem["status"];
        readonly problem: ProblemDetailsFor<Problem>;
        readonly declaration: Problem;
        readonly response: Response;
      }
    : never;

export type ProblemFetchProblemFailure<Problem extends ProblemDeclaration = ProblemDeclaration> =
  Problem extends ProblemDeclaration
    ? {
        readonly ok: false;
        readonly kind: "problem";
        readonly code: Problem["code"];
        readonly status: Problem["status"];
        readonly problem: ProblemDetailsFor<Problem>;
        readonly response: Response;
        readonly category?: Problem["category"];
        readonly declaration?: Problem;
      }
    : never;

export type ProblemClientExternalFailure = {
  readonly ok: false;
  readonly kind: "external";
  readonly error: ProblemResponseError | ProblemClientError;
  readonly response: Response;
  readonly body?: unknown;
};

export type ProblemClientFailure<Problem extends ProblemDeclaration = never> =
  | ([Problem] extends [never] ? never : ProblemClientProblemFailure<Problem>)
  | ProblemClientExternalFailure;

export type ProblemClientResult<T, Problem extends ProblemDeclaration = never> =
  | ProblemClientSuccess<T>
  | ProblemClientFailure<Problem>;

export type ProblemResult<T, Problem extends ProblemDeclaration = ProblemDeclaration> =
  | ProblemClientSuccess<T>
  | ProblemFetchProblemFailure<Problem>
  | ProblemClientExternalFailure;

export type ProblemFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ProblemFetchOptions<Problem extends ProblemDeclaration = ProblemDeclaration> = {
  readonly declaredProblems?: readonly Problem[];
  readonly fetch?: ProblemFetch;
};

export type ProblemFormFieldControl =
  | "text"
  | "number"
  | "checkbox"
  | "select"
  | "multi-select"
  | "list";

export type ProblemFormFieldValueKind = "string" | "number" | "boolean" | "enum" | "array";

export type ProblemFormFieldOption = {
  readonly label: string;
  readonly value: string | number | boolean | null;
};

export type ProblemFormField<Value = unknown> = {
  readonly name: string;
  readonly label: string;
  readonly control: ProblemFormFieldControl;
  readonly valueKind: ProblemFormFieldValueKind;
  readonly required: boolean;
  readonly initialValue: Value;
  readonly options?: readonly ProblemFormFieldOption[];
};

export type ProblemFormModel<
  Values extends Record<string, unknown>,
  FieldName extends keyof Values & string,
> = {
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly method: string;
  readonly path: string;
  readonly fieldNames: readonly FieldName[];
  readonly fields: readonly ProblemFormField<Values[FieldName]>[];
  readonly initialValues: Values;
};

export type ProblemValidationDeclaration<Problem extends ProblemDeclaration> = Extract<
  Problem,
  { readonly category: "ValidationError" }
>;

export type ProblemDomainDeclaration<Problem extends ProblemDeclaration> = Exclude<
  Problem,
  ProblemValidationDeclaration<Problem>
>;

export type ProblemFormFieldErrors<FieldName extends string> = Partial<
  Record<FieldName, readonly string[]>
>;

export type ProblemFormFieldProblem<
  FieldName extends string,
  Problem extends ProblemDeclaration,
> = [Problem] extends [never]
  ? never
  : Problem extends ProblemDeclaration
    ? {
        readonly kind: "field-validation";
        readonly code: Problem["code"];
        readonly category: Problem["category"];
        readonly status: Problem["status"];
        readonly fields: ProblemFormFieldErrors<FieldName>;
        readonly problem: ProblemDetailsFor<Problem>;
        readonly declaration: Problem;
        readonly response: Response;
      }
    : never;

export type ProblemFormGlobalProblem<Problem extends ProblemDeclaration> = [Problem] extends [never]
  ? never
  : Problem extends ProblemDeclaration
    ? {
        readonly kind: "global-problem";
        readonly code: Problem["code"];
        readonly category: Problem["category"];
        readonly status: Problem["status"];
        readonly problem: ProblemDetailsFor<Problem>;
        readonly declaration: Problem;
        readonly response: Response;
      }
    : never;

export type ProblemFormProblem<FieldName extends string, Problem extends ProblemDeclaration> =
  | ProblemFormFieldProblem<FieldName, ProblemValidationDeclaration<Problem>>
  | ProblemFormGlobalProblem<ProblemDomainDeclaration<Problem>>;

export class ProblemClientError extends Error {
  readonly problem: ProblemDetails;
  readonly response: Response;

  constructor(problem: ProblemDetails, response: Response) {
    super(problem.detail ?? problem.title);
    this.name = "ProblemClientError";
    this.problem = problem;
    this.response = response;
  }
}

export class ProblemResponseError extends Error {
  readonly response: Response;
  readonly body?: unknown;
  readonly cause?: unknown;

  constructor(response: Response, body?: unknown, cause?: unknown) {
    super(`Problem-aware request failed with HTTP ${response.status}`);
    this.name = "ProblemResponseError";
    this.response = response;
    this.body = body;
    this.cause = cause;
  }
}

export class ProblemFetchUnavailableError extends Problem {
  readonly code = "frontend-problems/fetch-unavailable";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "Problem-aware fetch requires globalThis.fetch or options.fetch.");
  }
}

function toExternalJsonFailure(
  cause: unknown,
  response: Response,
  body?: string,
): ProblemClientExternalFailure {
  if (isAbortError(cause) || !(cause instanceof SyntaxError)) {
    throw cause;
  }

  return {
    ok: false,
    kind: "external",
    error: new ProblemResponseError(response, body, cause),
    response,
    ...(body === undefined ? {} : { body }),
  };
}

export async function fetchProblemJson<
  T = unknown,
  Problem extends ProblemDeclaration = ProblemDeclaration,
>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ProblemFetchOptions<Problem> = {},
): Promise<ProblemResult<T, Problem>> {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new ProblemFetchUnavailableError();
  }

  const response = await fetchImpl(input, init);

  return readJsonProblemResult<T, Problem>(response, options.declaredProblems ?? []);
}

export async function fetchOptionalProblemJson<
  Problem extends ProblemDeclaration = ProblemDeclaration,
>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ProblemFetchOptions<Problem> = {},
): Promise<ProblemResult<unknown | undefined, Problem>> {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new ProblemFetchUnavailableError();
  }

  const response = await fetchImpl(input, init);

  return readOptionalJsonProblemResult<Problem>(response, options.declaredProblems ?? []);
}

export async function handleJsonResponse<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    return rejectErrorResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    if (isAbortError(cause)) {
      throw cause;
    }

    if (cause instanceof SyntaxError) {
      throw new ProblemResponseError(response, undefined, cause);
    }

    throw cause;
  }
}

export async function handleJsonResult<T = unknown, Problem extends ProblemDeclaration = never>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<ProblemClientResult<T, Problem>> {
  if (!response.ok) {
    return readDeclaredProblemErrorResult(response, declaredProblems);
  }

  try {
    return { ok: true, data: (await response.json()) as T, response };
  } catch (cause) {
    return toExternalJsonFailure(cause, response);
  }
}

export async function readJsonProblemResult<
  T = unknown,
  Problem extends ProblemDeclaration = ProblemDeclaration,
>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<ProblemResult<T, Problem>> {
  if (!response.ok) {
    return readProblemErrorResult(response, declaredProblems);
  }

  try {
    return { ok: true, data: (await response.json()) as T, response };
  } catch (cause) {
    return toExternalJsonFailure(cause, response);
  }
}

export async function readOptionalJsonResponse(response: Response): Promise<unknown | undefined> {
  if (!response.ok) {
    return rejectErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined;
  }

  const body = await response.text();

  if (body.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch (cause) {
    throw new ProblemResponseError(response, body, cause);
  }
}

export async function readOptionalJsonResult<Problem extends ProblemDeclaration = never>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<ProblemClientResult<unknown | undefined, Problem>> {
  if (!response.ok) {
    return readDeclaredProblemErrorResult(response, declaredProblems);
  }

  if (response.status === 204) {
    return { ok: true, data: undefined, response };
  }

  const body = await response.text();

  if (body.length === 0) {
    return { ok: true, data: undefined, response };
  }

  try {
    return { ok: true, data: JSON.parse(body) as unknown, response };
  } catch (cause) {
    return toExternalJsonFailure(cause, response, body);
  }
}

export async function readOptionalJsonProblemResult<
  Problem extends ProblemDeclaration = ProblemDeclaration,
>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<ProblemResult<unknown | undefined, Problem>> {
  if (!response.ok) {
    return readProblemErrorResult(response, declaredProblems);
  }

  if (response.status === 204) {
    return { ok: true, data: undefined, response };
  }

  const body = await response.text();

  if (body.length === 0) {
    return { ok: true, data: undefined, response };
  }

  try {
    return { ok: true, data: JSON.parse(body) as unknown, response };
  } catch (cause) {
    return toExternalJsonFailure(cause, response, body);
  }
}

export async function readDeclaredProblemErrorResult<Problem extends ProblemDeclaration>(
  response: Response,
  declaredProblems: readonly Problem[],
): Promise<ProblemClientFailure<Problem>> {
  const bodyResult = await readJsonBody(response);

  if (!bodyResult.ok) {
    return {
      ok: false,
      kind: "external",
      error: new ProblemResponseError(response),
      response,
    };
  }

  const problem = parseProblemDetails(bodyResult.body);

  if (problem) {
    const declaration = findProblemDeclaration(problem, declaredProblems);

    if (declaration) {
      return {
        ok: false,
        kind: "problem",
        code: declaration.code,
        category: declaration.category,
        status: declaration.status,
        problem: problem as ProblemDetailsFor<Problem>,
        declaration,
        response,
      } as ProblemClientFailure<Problem>;
    }

    return {
      ok: false,
      kind: "external",
      error: new ProblemClientError(problem, response),
      response,
      body: bodyResult.body,
    };
  }

  return {
    ok: false,
    kind: "external",
    error: new ProblemResponseError(response, bodyResult.body),
    response,
    body: bodyResult.body,
  };
}

export async function readProblemErrorResult<
  Problem extends ProblemDeclaration = ProblemDeclaration,
>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<ProblemFetchProblemFailure<Problem> | ProblemClientExternalFailure> {
  const bodyResult = await readJsonBody(response);

  if (!bodyResult.ok) {
    return {
      ok: false,
      kind: "external",
      error: new ProblemResponseError(response),
      response,
    };
  }

  const problem = parseProblemDetails(bodyResult.body);

  if (!problem) {
    return {
      ok: false,
      kind: "external",
      error: new ProblemResponseError(response, bodyResult.body),
      response,
      body: bodyResult.body,
    };
  }

  const declaration = findProblemDeclaration(problem, declaredProblems);

  return {
    ok: false,
    kind: "problem",
    code: declaration?.code ?? problem.code,
    status: declaration?.status ?? problem.status,
    problem: problem as ProblemDetailsFor<Problem>,
    response,
    ...(declaration ? { category: declaration.category, declaration } : {}),
  } as ProblemFetchProblemFailure<Problem>;
}

export function parseProblemDetails(value: unknown): ProblemDetails | null {
  return isProblemDetails(value) ? value : null;
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "number" &&
    Number.isFinite(value.status) &&
    typeof value.code === "string" &&
    (value.detail === undefined || typeof value.detail === "string") &&
    (value.instance === undefined || typeof value.instance === "string")
  );
}

export function findProblemDeclaration<Problem extends ProblemDeclaration>(
  problem: ProblemDetails,
  declaredProblems: readonly Problem[],
): Problem | undefined {
  return declaredProblems.find(
    (declaration) => declaration.code === problem.code && declaration.status === problem.status,
  );
}

export function assertProblemExhaustive(problem: never): never {
  const value = problem as { readonly code?: unknown } | undefined;
  const suffix = typeof value?.code === "string" ? `: ${value.code}` : "";

  throw new Error(`Unhandled Problem variant${suffix}`);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function toProblemFormProblem<FieldName extends string, Problem extends ProblemDeclaration>(
  failure: ProblemClientProblemFailure<Problem>,
  fieldNames: readonly FieldName[],
): ProblemFormProblem<FieldName, Problem> {
  if (failure.category === "ValidationError") {
    return {
      kind: "field-validation",
      code: failure.code,
      category: failure.category,
      status: failure.status,
      fields: extractProblemFormFieldErrors(failure.problem, fieldNames),
      problem: failure.problem,
      declaration: failure.declaration,
      response: failure.response,
    } as ProblemFormProblem<FieldName, Problem>;
  }

  return {
    kind: "global-problem",
    code: failure.code,
    category: failure.category,
    status: failure.status,
    problem: failure.problem,
    declaration: failure.declaration,
    response: failure.response,
  } as ProblemFormProblem<FieldName, Problem>;
}

export function extractProblemFormFieldErrors<FieldName extends string>(
  problem: ProblemDetails,
  fieldNames: readonly FieldName[],
): ProblemFormFieldErrors<FieldName> {
  const source = getProblemFormFieldErrorSource(problem);
  const errors: Partial<Record<FieldName, readonly string[]>> = {};

  if (!source) {
    return errors;
  }

  for (const fieldName of fieldNames) {
    const value = source[fieldName];

    if (typeof value === "string") {
      errors[fieldName] = [value];
      continue;
    }

    if (Array.isArray(value)) {
      const messages = value.filter((item): item is string => typeof item === "string");

      if (messages.length > 0) {
        errors[fieldName] = messages;
      }
    }
  }

  return errors;
}

async function rejectErrorResponse(response: Response): Promise<never> {
  const bodyResult = await readJsonBody(response);

  if (!bodyResult.ok) {
    throw new ProblemResponseError(response);
  }

  const problem = parseProblemDetails(bodyResult.body);

  if (problem) {
    throw new ProblemClientError(problem, response);
  }

  throw new ProblemResponseError(response, bodyResult.body);
}

async function readJsonBody(
  response: Response,
): Promise<{ readonly ok: true; readonly body: unknown } | { readonly ok: false }> {
  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false };
  }
}

function getProblemFormFieldErrorSource(
  problem: ProblemDetails,
): Record<string, unknown> | undefined {
  if (isRecord(problem.fields)) {
    return problem.fields;
  }

  if (isRecord(problem.fieldErrors)) {
    return problem.fieldErrors;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
