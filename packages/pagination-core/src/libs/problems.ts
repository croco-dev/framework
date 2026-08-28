import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Reports a repeated scalar pagination query parameter and records its field and supplied value count.
 */
export class AmbiguousPaginationParameterProblem extends Problem {
  readonly code = "AMBIGUOUS_PAGINATION_PARAMETER";
  readonly category = ProblemCategory.BadRequest;

  constructor(
    readonly field: "cursor" | "direction" | "limit" | "offset",
    readonly valueCount: number,
  ) {
    super(
      "AMBIGUOUS_PAGINATION_PARAMETER",
      ProblemCategory.BadRequest,
      `Pagination parameter '${field}' must be provided at most once`,
      {
        extensions: {
          field,
          reason: "repeated-value",
          valueCount,
        },
      },
    );
  }
}

export class InvalidCursorProblem extends Problem {
  readonly code = "INVALID_CURSOR";
  readonly category = ProblemCategory.BadRequest;

  constructor(detail?: string) {
    super(
      "INVALID_CURSOR",
      ProblemCategory.BadRequest,
      detail ?? "The provided cursor is invalid or malformed",
    );
  }
}

export class ConflictingPaginationProblem extends Problem {
  readonly code = "CONFLICTING_PAGINATION";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(
      "CONFLICTING_PAGINATION",
      ProblemCategory.BadRequest,
      "Cannot use both cursor and offset pagination simultaneously",
    );
  }
}

export type InvalidPaginationDirectionProblemOptions =
  | {
      mode: "cursor";
      reason: "unsupported-value";
    }
  | {
      mode: "offset";
      reason: "offset-mode";
    };

export class InvalidPaginationDirectionProblem extends Problem {
  readonly code = "INVALID_PAGINATION_DIRECTION";
  readonly category = ProblemCategory.BadRequest;
  readonly mode: "cursor" | "offset";
  readonly reason: "offset-mode" | "unsupported-value";

  constructor(options: InvalidPaginationDirectionProblemOptions) {
    const detail =
      options.reason === "offset-mode"
        ? "Pagination direction is only supported in cursor mode"
        : "Pagination direction must be either 'forward' or 'backward'";

    super("INVALID_PAGINATION_DIRECTION", ProblemCategory.BadRequest, detail, {
      extensions: {
        field: "direction",
        mode: options.mode,
        reason: options.reason,
        ...(options.reason === "unsupported-value"
          ? { allowedValues: ["forward", "backward"] }
          : { validMode: "cursor" }),
      },
    });
    this.mode = options.mode;
    this.reason = options.reason;
  }
}
