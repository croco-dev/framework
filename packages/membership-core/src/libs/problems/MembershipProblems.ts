import { Problem, ProblemCategory } from "@croco/problems-core";

export class MembershipNotFoundProblem extends Problem {
  constructor(tenantId: string, userId: string) {
    super(
      "MEMBERSHIP_NOT_FOUND",
      ProblemCategory.NotFound,
      `Membership not found for tenant '${tenantId}' and user '${userId}'`,
      {
        extensions: { tenantId, userId },
      },
    );
  }
}

export class AlreadyMemberProblem extends Problem {
  constructor(tenantId: string, userId: string) {
    super(
      "ALREADY_MEMBER",
      ProblemCategory.Conflict,
      `User '${userId}' is already a member of tenant '${tenantId}'`,
      {
        extensions: { tenantId, userId },
      },
    );
  }
}

export class LastOwnerProblem extends Problem {
  constructor(tenantId: string, userId: string, operation: "remove" | "demote") {
    super(
      "LAST_OWNER",
      ProblemCategory.Forbidden,
      `Cannot ${operation} the last owner '${userId}' in tenant '${tenantId}'`,
      {
        extensions: { tenantId, userId, operation },
      },
    );
  }
}

export class InvalidRoleProblem extends Problem {
  constructor(role: string) {
    super("INVALID_ROLE", ProblemCategory.BadRequest, `Invalid membership role: '${role}'`, {
      extensions: { role },
    });
  }
}

export class RoleHierarchyViolationProblem extends Problem {
  constructor(fromRole: string, toRole: string, operation: "promote" | "demote") {
    super(
      "ROLE_HIERARCHY_VIOLATION",
      ProblemCategory.Forbidden,
      `Cannot ${operation} from '${fromRole}' to '${toRole}': invalid hierarchy`,
      {
        extensions: { fromRole, toRole, operation },
      },
    );
  }
}

export class OwnershipTransferRequiredProblem extends Problem {
  constructor(tenantId: string, userId: string) {
    super(
      "OWNERSHIP_TRANSFER_REQUIRED",
      ProblemCategory.Forbidden,
      `Cannot change role of owner '${userId}' without transferring ownership. Use transferOwnership() instead.`,
      {
        extensions: { tenantId, userId },
      },
    );
  }
}

export class SeatLimitExceededProblem extends Problem {
  constructor(tenantId: string, currentSeats: number, maxSeats: number) {
    super(
      "SEAT_LIMIT_EXCEEDED",
      ProblemCategory.Forbidden,
      `Seat limit exceeded for tenant '${tenantId}': ${currentSeats}/${maxSeats} seats used`,
      {
        extensions: { tenantId, currentSeats, maxSeats },
      },
    );
  }
}
