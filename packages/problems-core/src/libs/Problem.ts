import { ProblemCategory } from "./ProblemCategory";
import { ProblemCategoryMapper } from "./ProblemCategoryMapper";
import type { ProblemExtensions } from "./ProblemExtensions";

export type ProblemOptions = {
  type?: string;
  instance?: string;
  extensions?: ProblemExtensions;
  cause?: Error;
};

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
} & Record<string, unknown>;

export type TypedProblemDetails<
  Code extends string = string,
  Status extends number = number,
> = Omit<ProblemDetails, "code" | "status"> & {
  code: Code;
  status: Status;
};

export function assertProblemExhaustive(problem: never): never {
  const value = problem as { readonly code?: unknown } | undefined;
  const suffix = typeof value?.code === "string" ? `: ${value.code}` : "";

  throw new Error(`Unhandled Problem variant${suffix}`);
}

export abstract class Problem extends Error {
  public readonly code: string;
  public readonly category: ProblemCategory;
  public readonly detail?: string;
  public readonly type: string;
  public readonly instance?: string;
  public readonly extensions?: ProblemExtensions;
  public readonly cause?: Error;

  protected constructor(
    code?: string,
    category?: ProblemCategory,
    detail?: string,
    options?: ProblemOptions,
  ) {
    super(detail ?? code ?? "Unknown error");

    this.code = code ?? "UNKNOWN_ERROR";
    this.category = category ?? ProblemCategory.InternalServerError;

    this.detail = detail;
    this.type = options?.type ?? "about:blank";
    this.instance = options?.instance;
    this.extensions = options?.extensions;
    this.name = new.target.name;

    if (options?.cause && this.cause === undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  public get title(): string {
    return ProblemCategoryMapper.toTitle(this.category);
  }

  public get status(): number {
    return ProblemCategoryMapper.toHttpStatus(this.category);
  }

  public toJSON(): ProblemDetails {
    const result: ProblemDetails = {
      type: this.type,
      title: this.title,
      status: this.status,
      code: this.code,
    };

    if (this.detail) {
      result.detail = this.detail;
    }

    if (this.instance) {
      result.instance = this.instance;
    }

    if (this.extensions) {
      Object.assign(result, this.extensions);
    }

    return result;
  }
}
