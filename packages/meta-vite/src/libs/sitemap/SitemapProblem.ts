import { Problem, ProblemCategory } from "@croco/problems-core";
import type { SitemapReport } from "./types";

export class SitemapProblem extends Problem {
  readonly code = "meta-vite/sitemap";

  constructor(
    readonly reason:
      | "invalid-policy"
      | "source-incomplete"
      | "limit"
      | "storage"
      | "conflict"
      | "access",
    readonly report?: SitemapReport,
  ) {
    super(
      "meta-vite/sitemap",
      reason === "access"
        ? ProblemCategory.Forbidden
        : reason === "conflict"
          ? ProblemCategory.Conflict
          : reason === "storage" || reason === "source-incomplete"
            ? ProblemCategory.InternalServerError
            : reason === "limit"
              ? ProblemCategory.PayloadTooLarge
              : ProblemCategory.BadRequest,
      `Sitemap operation failed: ${reason}`,
    );
  }
}
