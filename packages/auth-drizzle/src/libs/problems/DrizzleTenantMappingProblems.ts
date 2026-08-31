import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 외부 조직이 이미 다른 tenant에 매핑되어 있을 때 발생하는 Problem입니다.
 */
export class DuplicateTenantMappingProblem extends Problem {
  readonly code = "auth-drizzle/duplicate-tenant-mapping";
  readonly category = ProblemCategory.Conflict;

  constructor(externalOrgId: string, existingTenantId: string, nextTenantId: string) {
    super(
      undefined,
      undefined,
      `External organization '${externalOrgId}' is already mapped to tenant '${existingTenantId}' and cannot be remapped to '${nextTenantId}'`,
    );
  }
}

/**
 * 충돌한 tenant 매핑의 권위 행을 조회하지 못했을 때 발생하는 Problem입니다.
 */
export class TenantMappingConflictResolutionProblem extends Problem {
  readonly code = "auth-drizzle/tenant-mapping-conflict-resolution-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(externalOrgId: string, requestedTenantId: string) {
    super(
      undefined,
      undefined,
      `Tenant mapping conflict for external organization '${externalOrgId}' did not expose an authoritative mapping`,
      {
        extensions: {
          externalOrgId,
          requestedTenantId,
        },
      },
    );
  }
}
