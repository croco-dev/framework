import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  AuthProviderUnavailableProblem,
  InvalidPermissionActionProblem,
  InvalidPermissionFormatProblem,
  InvalidRouteMetadataTargetProblem,
} from "../libs/problems/AuthProblems";

describe("AuthProblems", () => {
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
