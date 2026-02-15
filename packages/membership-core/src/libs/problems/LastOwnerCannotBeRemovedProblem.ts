import { MembershipConstraintProblem } from './MembershipConstraintProblem';

export class LastOwnerCannotBeRemovedProblem extends MembershipConstraintProblem {
  constructor(tenantId: string, userId: string) {
    super(
      `Cannot remove the last owner '${userId}' in tenant '${tenantId}'`,
      {
        tenantId,
        userId,
        operation: 'remove',
      },
      'LAST_OWNER_CANNOT_BE_REMOVED'
    );
  }
}
