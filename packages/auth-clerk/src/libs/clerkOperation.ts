import {
  createClerkOperationProblem,
  isClerkResourceNotFoundError,
} from "./problems/ClerkProblems";

type ClerkOperation =
  | "organizations.createOrganization"
  | "organizations.createOrganizationInvitation"
  | "organizations.createOrganizationMembership"
  | "organizations.deleteOrganization"
  | "organizations.deleteOrganizationMembership"
  | "organizations.getOrganization"
  | "organizations.getOrganizationInvitationList"
  | "organizations.getOrganizationList"
  | "organizations.getOrganizationMembershipList"
  | "organizations.revokeOrganizationInvitation"
  | "organizations.updateOrganization"
  | "organizations.updateOrganizationMembership"
  | "sessions.getSession"
  | "sessions.getSessionList"
  | "sessions.revokeSession"
  | "users.banUser"
  | "users.createUser"
  | "users.deleteUser"
  | "users.getUser"
  | "users.getUserList"
  | "users.unbanUser"
  | "users.updateUser"
  | "users.updateUserMetadata";

export async function executeClerkOperation<T>(
  operation: ClerkOperation,
  execute: () => Promise<T>,
): Promise<T> {
  try {
    return await execute();
  } catch (error: unknown) {
    throw createClerkOperationProblem(error, operation);
  }
}

export async function executeClerkLookup<T>(
  operation: ClerkOperation,
  execute: () => Promise<T>,
  options: { allowNotFoundMessage?: boolean } = {},
): Promise<T | null> {
  try {
    return await execute();
  } catch (error: unknown) {
    if (isClerkResourceNotFoundError(error, options.allowNotFoundMessage)) {
      return null;
    }

    throw createClerkOperationProblem(error, operation);
  }
}
