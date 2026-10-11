import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Personalized fragment cache failures must stay request-scoped.
 * Shared fragment bytes never carry private values, so these Problems
 * describe zone, representation, or loader misuse without leaking
 * raw keys, dimension values, or private payloads.
 */
export class PersonalizedFragmentProblem extends Problem {
  readonly code = "meta-vite/personalized-fragment-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string, extensions?: { readonly reason: string }) {
    super("meta-vite/personalized-fragment-invalid", ProblemCategory.ValidationError, detail, {
      extensions,
    });
  }
}
