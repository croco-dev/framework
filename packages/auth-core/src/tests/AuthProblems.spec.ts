import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  ApiKeyCreationFailedProblem,
  ApiKeyExpiredProblem,
  ApiKeyRevokedProblem,
  ApiKeyRotationConflictProblem,
  AuthProviderUnavailableProblem,
  ForbiddenProblem,
  InvalidApiKeyRotationIdempotencyKeyProblem,
  InvalidPermissionActionProblem,
  InvalidPermissionFormatProblem,
  InvalidRouteMetadataTargetProblem,
  UnauthorizedProblem,
} from "../libs/problems/AuthProblems";

const serializedDetailCases = [
  {
    name: "UnauthorizedProblem",
    problem: new UnauthorizedProblem("Custom authentication detail"),
    code: "UNAUTHORIZED",
    category: ProblemCategory.Unauthorized,
    detail: "Custom authentication detail",
  },
  {
    name: "ForbiddenProblem",
    problem: new ForbiddenProblem("Custom authorization detail"),
    code: "FORBIDDEN",
    category: ProblemCategory.Forbidden,
    detail: "Custom authorization detail",
  },
  {
    name: "ApiKeyExpiredProblem",
    problem: new ApiKeyExpiredProblem("Custom expiration detail"),
    code: "API_KEY_EXPIRED",
    category: ProblemCategory.Unauthorized,
    detail: "Custom expiration detail",
  },
  {
    name: "ApiKeyRevokedProblem",
    problem: new ApiKeyRevokedProblem("Custom revocation detail"),
    code: "API_KEY_REVOKED",
    category: ProblemCategory.Unauthorized,
    detail: "Custom revocation detail",
  },
  {
    name: "ApiKeyCreationFailedProblem",
    problem: new ApiKeyCreationFailedProblem("Custom creation detail"),
    code: "auth-core/api-key-creation-failed",
    category: ProblemCategory.InternalServerError,
    detail: "Custom creation detail",
  },
  {
    name: "ApiKeyRotationConflictProblem",
    problem: new ApiKeyRotationConflictProblem("Custom rotation conflict detail"),
    code: "auth-core/api-key-rotation-conflict",
    category: ProblemCategory.Conflict,
    detail: "Custom rotation conflict detail",
  },
  {
    name: "InvalidApiKeyRotationIdempotencyKeyProblem",
    problem: new InvalidApiKeyRotationIdempotencyKeyProblem(),
    code: "auth-core/invalid-api-key-rotation-idempotency-key",
    category: ProblemCategory.ValidationError,
    detail: "API key rotation idempotency key must contain between 1 and 255 characters",
  },
] as const;

describe("AuthProblems", () => {
  it.each(serializedDetailCases)(
    "serializes the detail for $name",
    ({ problem, code, category, detail }) => {
      expect(problem.category).toBe(category);
      expect(problem.toJSON()).toMatchObject({ code, detail });
    },
  );

  describe("InvalidPermissionFormatProblem", () => {
    it("has correct code and category", () => {
      const problem = new InvalidPermissionFormatProblem("invalid");

      expect(problem.code).toBe("auth-core/invalid-permission-format");
      expect(problem.category).toBe(ProblemCategory.ValidationError);
    });
  });

  describe("InvalidPermissionActionProblem", () => {
    it("has correct code and category", () => {
      const problem = new InvalidPermissionActionProblem("invalid_action");

      expect(problem.code).toBe("auth-core/invalid-permission-action");
      expect(problem.category).toBe(ProblemCategory.ValidationError);
    });
  });

  describe("AuthProviderUnavailableProblem", () => {
    it("has correct code and category", () => {
      const problem = new AuthProviderUnavailableProblem();

      expect(problem.code).toBe("auth-core/auth-provider-unavailable");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
    });
  });

  describe("InvalidRouteMetadataTargetProblem", () => {
    it("has a stable code and reports the invalid target type", () => {
      const problem = new InvalidRouteMetadataTargetProblem(null);

      expect(problem.code).toBe("auth-core/invalid-route-metadata-target");
      expect(problem.category).toBe(ProblemCategory.InternalServerError);
      expect(problem.message).toContain("received null");
    });
  });
});
