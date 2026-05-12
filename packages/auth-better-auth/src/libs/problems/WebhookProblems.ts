import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Better Auth 웹훅 서명이 유효하지 않을 때 발생하는 문제입니다.
 */
export class InvalidWebhookSignatureProblem extends Problem {
  readonly code = "auth-better-auth/invalid-webhook-signature";
  readonly category = ProblemCategory.Unauthorized;

  constructor() {
    super(
      "auth-better-auth/invalid-webhook-signature",
      ProblemCategory.Unauthorized,
      "Invalid webhook signature",
    );
  }
}

/**
 * Better Auth 웹훅 본문이 기대한 형식과 다를 때 발생하는 문제입니다.
 */
export class InvalidWebhookPayloadProblem extends Problem {
  readonly code = "auth-better-auth/invalid-webhook-payload";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(
      "auth-better-auth/invalid-webhook-payload",
      ProblemCategory.BadRequest,
      "Invalid webhook payload",
    );
  }
}
