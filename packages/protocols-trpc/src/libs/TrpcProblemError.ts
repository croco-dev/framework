import {
  createProblemResponseDetail,
  createProblemResponseExtensions,
  Problem,
  ProblemCategory,
  ProblemSerializer,
  resolveProblemResponseRedactionPolicy,
} from "@croco/problems-core";
import type { ProblemDetails } from "@croco/problems-core";

export type TrpcProblemDetails = {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail?: string;
  readonly extensions: Record<string, unknown>;
};

export function createTrpcProblemDetails(problem: Problem): TrpcProblemDetails {
  const redactionPolicy = resolveProblemResponseRedactionPolicy(problem);
  const detail = createProblemResponseDetail(problem.detail, redactionPolicy);

  return {
    code: problem.code,
    status: problem.status,
    title: problem.title,
    type: problem.type,
    ...(detail !== undefined ? { detail } : {}),
    extensions: createProblemResponseExtensions(problem.extensions, redactionPolicy),
  };
}

export function getTrpcProblem(error: { readonly cause?: unknown }): Problem | undefined {
  return error.cause instanceof Problem ? error.cause : undefined;
}

export function createTrpcFilterProblem(
  body: Record<string, unknown>,
  status: number,
): Problem | undefined {
  if (status < 400 || status > 599) {
    return undefined;
  }

  try {
    const details = ProblemSerializer.fromJson(body);

    if (details.status !== status) {
      return undefined;
    }

    return new TrpcFilterProblem(details);
  } catch {
    return undefined;
  }
}

class TrpcFilterProblem extends Problem {
  private readonly filterStatus: number;
  private readonly filterTitle: string;

  constructor(details: ProblemDetails) {
    const { type, title, status, detail, instance, code, ...extensions } = details;
    super(code, toProblemCategory(status), detail, {
      type,
      ...(instance !== undefined ? { instance } : {}),
      ...(Object.keys(extensions).length > 0 ? { extensions } : {}),
    });
    this.filterStatus = status;
    this.filterTitle = title;
  }

  override get status(): number {
    return this.filterStatus;
  }

  override get title(): string {
    return this.filterTitle;
  }
}

function toProblemCategory(status: number): ProblemCategory {
  switch (status) {
    case 400:
      return ProblemCategory.BadRequest;
    case 401:
      return ProblemCategory.Unauthorized;
    case 403:
      return ProblemCategory.Forbidden;
    case 404:
      return ProblemCategory.NotFound;
    case 409:
      return ProblemCategory.Conflict;
    case 410:
      return ProblemCategory.Gone;
    case 413:
      return ProblemCategory.PayloadTooLarge;
    case 422:
      return ProblemCategory.ValidationError;
    case 429:
      return ProblemCategory.TooManyRequests;
    case 501:
      return ProblemCategory.NotImplemented;
    default:
      return ProblemCategory.InternalServerError;
  }
}
