import { Problem, ProblemCategory } from "@croco/problems-core";
import { ID_PREFIX_GRAMMAR, MAXIMUM_ID_PREFIX_LENGTH } from "../idPrefixPolicy";

export class InvalidIdPrefixProblem extends Problem {
  readonly code = "gid-core/invalid-id-prefix";
  readonly category = ProblemCategory.ValidationError;

  constructor(
    length: number,
    minimumLength: number,
    reason: "invalid-length" | "too-short" | "too-long" | "invalid-characters" = "invalid-length",
  ) {
    const detail =
      reason === "invalid-characters"
        ? `Prefix must contain only lowercase ASCII letters and digits and match ${ID_PREFIX_GRAMMAR}.`
        : `Prefix must contain between ${minimumLength} and ${MAXIMUM_ID_PREFIX_LENGTH} characters, but received length ${length}.`;

    super(undefined, undefined, detail, {
      extensions: {
        reason,
        length,
        minimumLength,
        maximumLength: MAXIMUM_ID_PREFIX_LENGTH,
        grammar: ID_PREFIX_GRAMMAR,
        retryable: false,
      },
    });
  }
}
