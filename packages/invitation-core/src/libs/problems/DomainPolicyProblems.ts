import { Problem, ProblemCategory } from "@croco/problems-core";

export class PublicEmailDomainNotAllowedProblem extends Problem {
  constructor(domain: string) {
    super(
      "PUBLIC_EMAIL_DOMAIN_NOT_ALLOWED",
      ProblemCategory.BadRequest,
      `Public email domain is not allowed: '${domain}'`,
      {
        extensions: { domain },
      },
    );
  }
}

export class InvalidAutoJoinRoleProblem extends Problem {
  constructor(role: string) {
    super(
      "INVALID_AUTO_JOIN_ROLE",
      ProblemCategory.BadRequest,
      `Auto-join role must be 'member' or 'viewer': '${role}'`,
      {
        extensions: { role },
      },
    );
  }
}
