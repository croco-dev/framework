import { Problem, ProblemCategory } from "@croco/problems-core";

const MAX_RESPONSE_BODY_EXCERPT_LENGTH = 500;
const REDACTED_RESPONSE_BODY_VALUE = "[redacted]";
const INVALID_JSON_RESPONSE_MESSAGE = "Response body is not valid JSON.";
const STRUCTURED_RESPONSE_SECRET_PATTERN =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)|github_pat_[a-zA-Z0-9_]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g;
const TRAILING_STRUCTURED_RESPONSE_SECRET_PATTERN =
  /(?:(?:github_pat_|gh[pousr]_)[a-zA-Z0-9_]*|AKIA[A-Z0-9]*|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*)?)$/g;
const SENSITIVE_RESPONSE_FIELD_PATTERN =
  /^(?:authorization|proxy[-_]?authorization|cookie|set[-_]?cookie|credential|password|passphrase|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|access[-_]?key(?:[-_]?id)?|access[-_]?token|refresh[-_]?token|client[-_]?secret|connection[-_]?string|dsn)$/i;
const QUOTED_JSON_FIELD_PATTERN =
  /"((?:\\.|[^"\\])*)"(\s*:\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:bearer|basic|digest|apikey)\s+[^\r\n,;}\]]+|[^\r\n,;}\]]+)/gi;
const MAX_STRUCTURED_RESPONSE_DEPTH = 8;
const MAX_STRUCTURED_RESPONSE_ENTRIES = 100;

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
  readonly error: ProblemResponseError | ProblemClientError | ProblemStatusMismatchError;
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
  readonly bodyTruncated: boolean;
  readonly contentType?: string;
  readonly cause?: unknown;

  constructor(response: Response, body?: unknown, cause?: unknown) {
    super(`Problem-aware request failed with HTTP ${response.status}`);
    const evidence = createResponseBodyEvidence(body);

    this.name = "ProblemResponseError";
    this.response = response;
    this.body = evidence.body;
    this.bodyTruncated = evidence.truncated;
    this.contentType = response.headers.get("content-type") ?? undefined;
    this.cause = cause;
  }
}

/**
 * HTTP 응답 상태와 Problem 상태가 일치하지 않는 프로토콜 실패입니다.
 */
export class ProblemStatusMismatchError extends Problem {
  readonly code = "frontend-problems/status-mismatch";
  readonly category = ProblemCategory.InternalServerError;
  readonly response: Response;
  readonly httpStatus: number;
  readonly problemStatus: number;
  readonly problemCode?: string;

  constructor(response: Response, problemStatus: number, problemCode?: string) {
    super(
      undefined,
      undefined,
      problemCode === undefined
        ? `Problem response status mismatch: HTTP ${response.status}, Problem ${problemStatus}`
        : `Problem response status mismatch for ${problemCode}: HTTP ${response.status}, Problem ${problemStatus}`,
    );
    this.response = response;
    this.httpStatus = response.status;
    this.problemStatus = problemStatus;
    this.problemCode = problemCode;
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
  return toProblemResponseFailure(response, body, toJsonParsingCause(cause));
}

function toProblemResponseFailure(
  response: Response,
  body?: unknown,
  cause?: unknown,
): ProblemClientExternalFailure {
  const error = new ProblemResponseError(response, body, cause);

  return {
    ok: false,
    kind: "external",
    error,
    response,
    ...(error.body === undefined ? {} : { body: error.body }),
  };
}

function toJsonParsingCause(cause: unknown): SyntaxError {
  if (isAbortError(cause) || !(cause instanceof SyntaxError)) {
    throw cause;
  }

  return new SyntaxError(INVALID_JSON_RESPONSE_MESSAGE);
}

function createResponseBodyEvidence(body: unknown): {
  readonly body: unknown;
  readonly truncated: boolean;
} {
  if (typeof body === "string") {
    return createStringResponseBodyEvidence(body);
  }

  if (body === null || typeof body !== "object") {
    return { body, truncated: false };
  }

  const state: StructuredResponseEvidenceState = {
    remainingEntries: MAX_STRUCTURED_RESPONSE_ENTRIES,
    truncated: false,
    visited: new WeakSet<object>(),
  };
  const sanitized = sanitizeStructuredResponseBody(body, state, 0);
  const serialized = JSON.stringify(sanitized);

  if (serialized.length > MAX_RESPONSE_BODY_EXCERPT_LENGTH) {
    return createStringResponseBodyEvidence(serialized);
  }

  return { body: sanitized, truncated: state.truncated };
}

function createStringResponseBodyEvidence(body: string): {
  readonly body: string;
  readonly truncated: boolean;
} {
  const inputTruncated = body.length > MAX_RESPONSE_BODY_EXCERPT_LENGTH;
  const excerpt = inputTruncated ? body.slice(0, MAX_RESPONSE_BODY_EXCERPT_LENGTH - 3) : body;
  const redacted = redactResponseBody(excerpt, inputTruncated);
  const truncated = inputTruncated || redacted.length > MAX_RESPONSE_BODY_EXCERPT_LENGTH;

  return {
    body: truncated ? `${redacted.slice(0, MAX_RESPONSE_BODY_EXCERPT_LENGTH - 3)}...` : redacted,
    truncated,
  };
}

type StructuredResponseEvidenceState = {
  remainingEntries: number;
  truncated: boolean;
  readonly visited: WeakSet<object>;
};

function sanitizeStructuredResponseBody(
  value: unknown,
  state: StructuredResponseEvidenceState,
  depth: number,
): unknown {
  if (typeof value === "string") {
    const evidence = createStringResponseBodyEvidence(value);
    state.truncated ||= evidence.truncated;
    return evidence.body;
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value !== "object") {
    state.truncated = true;
    return "[unsupported]";
  }

  if (state.visited.has(value)) {
    state.truncated = true;
    return "[circular]";
  }

  if (depth >= MAX_STRUCTURED_RESPONSE_DEPTH || state.remainingEntries === 0) {
    state.truncated = true;
    return "[truncated]";
  }

  state.visited.add(value);

  if (Array.isArray(value)) {
    const sanitized: unknown[] = [];

    for (const entry of value) {
      if (state.remainingEntries === 0) {
        state.truncated = true;
        break;
      }

      state.remainingEntries -= 1;
      sanitized.push(sanitizeStructuredResponseBody(entry, state, depth + 1));
    }

    state.visited.delete(value);
    return sanitized;
  }

  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(value)) {
    if (state.remainingEntries === 0) {
      state.truncated = true;
      break;
    }

    state.remainingEntries -= 1;
    Object.defineProperty(sanitized, key, {
      configurable: true,
      enumerable: true,
      value: SENSITIVE_RESPONSE_FIELD_PATTERN.test(key)
        ? REDACTED_RESPONSE_BODY_VALUE
        : sanitizeStructuredResponseBody((value as Record<string, unknown>)[key], state, depth + 1),
      writable: true,
    });
  }

  state.visited.delete(value);
  return sanitized;
}

function redactResponseBody(body: string, inputTruncated: boolean): string {
  const withoutEscapedJsonFields = body.replace(
    QUOTED_JSON_FIELD_PATTERN,
    replaceSensitiveQuotedJsonValue,
  );
  const withoutCookies = withoutEscapedJsonFields.replace(
    /(["']?)(cookie|set[-_]?cookie)\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]+)/gi,
    replaceSensitiveResponseValue,
  );

  const redacted = withoutCookies
    .replace(
      /(["']?)(authorization|proxy[-_]?authorization|credential|password|passphrase|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|access[-_]?key(?:[-_]?id)?|access[-_]?token|refresh[-_]?token|client[-_]?secret|connection[-_]?string|dsn)\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:bearer|basic|digest|apikey)\s+[^\r\n,;}\]]+|[^\r\n,;}\]]+)/gi,
      replaceSensitiveResponseValue,
    )
    .replace(/\b(?:bearer|basic|digest|apikey)\s+[^\s,;}\]"']+/gi, REDACTED_RESPONSE_BODY_VALUE)
    .replace(STRUCTURED_RESPONSE_SECRET_PATTERN, REDACTED_RESPONSE_BODY_VALUE);

  return inputTruncated
    ? redacted.replace(TRAILING_STRUCTURED_RESPONSE_SECRET_PATTERN, REDACTED_RESPONSE_BODY_VALUE)
    : redacted;
}

function replaceSensitiveQuotedJsonValue(
  match: string,
  encodedLabel: string,
  separator: string,
): string {
  let label: unknown;

  try {
    label = JSON.parse(`"${encodedLabel}"`);
  } catch {
    return match;
  }

  if (typeof label !== "string" || !SENSITIVE_RESPONSE_FIELD_PATTERN.test(label)) {
    return match;
  }

  const value = match.slice(encodedLabel.length + separator.length + 2);
  const valueQuote = value.startsWith('"') || value.startsWith("'") ? value[0] : "";

  return `"${encodedLabel}"${separator}${valueQuote}${REDACTED_RESPONSE_BODY_VALUE}${valueQuote}`;
}

function replaceSensitiveResponseValue(
  match: string,
  labelQuote: string,
  label: string,
  separator: string,
): string {
  const value = match.slice(labelQuote.length * 2 + label.length + separator.length);
  const valueQuote = value.startsWith('"') || value.startsWith("'") ? value[0] : "";

  return `${labelQuote}${label}${labelQuote}${separator}${valueQuote}${REDACTED_RESPONSE_BODY_VALUE}${valueQuote}`;
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
    throw new ProblemResponseError(response, undefined, toJsonParsingCause(cause));
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
    throw new ProblemResponseError(response, body, toJsonParsingCause(cause));
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
    const statusMismatch = createProblemStatusMismatchError(response, problem);

    if (statusMismatch) {
      return {
        ok: false,
        kind: "external",
        error: statusMismatch,
        response,
        body: bodyResult.body,
      };
    }

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

  return toProblemResponseFailure(response, bodyResult.body);
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
    return toProblemResponseFailure(response, bodyResult.body);
  }

  const statusMismatch = createProblemStatusMismatchError(response, problem);

  if (statusMismatch) {
    return {
      ok: false,
      kind: "external",
      error: statusMismatch,
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
    const statusMismatch = createProblemStatusMismatchError(response, problem);

    if (statusMismatch) {
      throw statusMismatch;
    }

    throw new ProblemClientError(problem, response);
  }

  throw new ProblemResponseError(response, bodyResult.body);
}

function createProblemStatusMismatchError(
  response: Response,
  problem: ProblemDetails,
): ProblemStatusMismatchError | undefined {
  return response.status === problem.status
    ? undefined
    : new ProblemStatusMismatchError(response, problem.status, problem.code);
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
