import { type ClerkClient, createClerkClient } from "@clerk/backend";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ClerkAuthOptions } from "./ClerkAuthProvider";

export type ClerkOrganization = {
  id: string;
  name: string;
  slug: string;
  maxAllowedMemberships: number | null;
  adminDeleteEnabled: boolean;
  publicMetadata: Record<string, unknown> | null;
  privateMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ClerkOrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ClerkOrganizationInvitation = {
  id: string;
  organizationId: string;
  emailAddress: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOrganizationInput = {
  name: string;
  createdBy: string;
  slug?: string;
  maxAllowedMemberships?: number;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
};

export type UpdateOrganizationInput = {
  name?: string;
  slug?: string;
  maxAllowedMemberships?: number;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
};

export type OrganizationListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: "-created_at" | "created_at" | "-updated_at" | "updated_at";
  query?: string;
};

export type OrganizationListResult = {
  organizations: ClerkOrganization[];
  totalCount: number;
};

export type CreateMembershipInput = {
  organizationId: string;
  userId: string;
  role: string;
};

export type CreateInvitationInput = {
  organizationId: string;
  emailAddress: string;
  role: string;
  inviterUserId: string;
  redirectUrl?: string;
};

class ClerkOrganizationLookupProblem extends Problem {
  constructor(cause: Error) {
    super(
      "auth-clerk/organization-lookup-failed",
      ProblemCategory.InternalServerError,
      "Clerk organization lookup failed",
      { cause },
    );
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getClerkErrorStatus(error: unknown): number | undefined {
  if (!isObjectRecord(error)) {
    return undefined;
  }

  const status = error.status;
  if (typeof status === "number") {
    return status;
  }

  const statusCode = error.statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

function isMissingOrganizationError(error: unknown): boolean {
  const status = getClerkErrorStatus(error);
  if (status === 401 || status === 403 || status === 404) {
    return true;
  }

  const message = error instanceof Error ? error.message : undefined;
  return message?.toLowerCase().includes("not found") === true;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown Clerk organization lookup failure");
}

function mapClerkOrganization(org: {
  id: string;
  name: string;
  slug: string;
  maxAllowedMemberships: number | null;
  adminDeleteEnabled: boolean;
  publicMetadata: Record<string, unknown> | null;
  privateMetadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}): ClerkOrganization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    maxAllowedMemberships: org.maxAllowedMemberships,
    adminDeleteEnabled: org.adminDeleteEnabled,
    publicMetadata: org.publicMetadata ?? {},
    privateMetadata: org.privateMetadata,
    createdAt: new Date(org.createdAt),
    updatedAt: new Date(org.updatedAt),
  };
}

export class ClerkOrganizationService {
  private clerkClient: ClerkClient;

  constructor(options: ClerkAuthOptions) {
    this.clerkClient = createClerkClient({
      secretKey: options.secretKey,
      publishableKey: options.publishableKey,
    });
  }

  async getOrganization(organizationId: string): Promise<ClerkOrganization | null> {
    try {
      const org = await this.clerkClient.organizations.getOrganization({ organizationId });
      return mapClerkOrganization(org);
    } catch (error) {
      if (isMissingOrganizationError(error)) {
        return null;
      }

      throw new ClerkOrganizationLookupProblem(toError(error));
    }
  }

  async getOrganizationBySlug(slug: string): Promise<ClerkOrganization | null> {
    try {
      const org = await this.clerkClient.organizations.getOrganization({ slug });
      return mapClerkOrganization(org);
    } catch (error) {
      if (isMissingOrganizationError(error)) {
        return null;
      }

      throw new ClerkOrganizationLookupProblem(toError(error));
    }
  }

  async getOrganizationList(
    options: OrganizationListOptions = {},
  ): Promise<OrganizationListResult> {
    const params: Record<string, string | number> = {};

    if (options.limit !== undefined) {
      params.limit = options.limit;
    }
    if (options.offset !== undefined) {
      params.offset = options.offset;
    }
    if (options.orderBy) {
      params.orderBy = options.orderBy;
    }
    if (options.query) {
      params.query = options.query;
    }

    const response = await this.clerkClient.organizations.getOrganizationList(params);

    return {
      organizations: response.data.map(mapClerkOrganization),
      totalCount: response.totalCount,
    };
  }

  async createOrganization(input: CreateOrganizationInput): Promise<ClerkOrganization> {
    const org = await this.clerkClient.organizations.createOrganization({
      name: input.name,
      createdBy: input.createdBy,
      ...(input.slug && { slug: input.slug }),
      ...(input.maxAllowedMemberships && { maxAllowedMemberships: input.maxAllowedMemberships }),
      ...(input.publicMetadata && { publicMetadata: input.publicMetadata }),
      ...(input.privateMetadata && { privateMetadata: input.privateMetadata }),
    });

    return mapClerkOrganization(org);
  }

  async updateOrganization(
    organizationId: string,
    input: UpdateOrganizationInput,
  ): Promise<ClerkOrganization> {
    const org = await this.clerkClient.organizations.updateOrganization(organizationId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.maxAllowedMemberships !== undefined && {
        maxAllowedMemberships: input.maxAllowedMemberships,
      }),
      ...(input.publicMetadata !== undefined && { publicMetadata: input.publicMetadata }),
      ...(input.privateMetadata !== undefined && { privateMetadata: input.privateMetadata }),
    });

    return mapClerkOrganization(org);
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.clerkClient.organizations.deleteOrganization(organizationId);
  }

  async getOrganizationMembershipList(
    organizationId: string,
    _options?: { limit?: number; offset?: number },
  ): Promise<{
    memberships: ClerkOrganizationMembership[];
    totalCount: number;
  }> {
    const params = { organizationId };

    const response = await this.clerkClient.organizations.getOrganizationMembershipList(params);

    const memberships = response.data
      .filter(
        (
          membership,
        ): membership is typeof membership & {
          publicUserData: Exclude<typeof membership.publicUserData, null | undefined>;
        } => membership.publicUserData != null,
      )
      .map((membership) => ({
        id: membership.id,
        organizationId: membership.organization.id,
        userId: membership.publicUserData.userId,
        role: membership.role,
        createdAt: new Date(membership.createdAt),
        updatedAt: new Date(membership.updatedAt),
      }));

    return {
      memberships,
      totalCount: response.totalCount,
    };
  }

  async createOrganizationMembership(
    input: CreateMembershipInput,
  ): Promise<ClerkOrganizationMembership> {
    const membership = await this.clerkClient.organizations.createOrganizationMembership({
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
    });

    if (membership.publicUserData == null) {
      throw new Error("publicUserData is null");
    }

    return {
      id: membership.id,
      organizationId: membership.organization.id,
      userId: membership.publicUserData.userId,
      role: membership.role,
      createdAt: new Date(membership.createdAt),
      updatedAt: new Date(membership.updatedAt),
    };
  }

  async updateOrganizationMembership(
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<ClerkOrganizationMembership> {
    const membership = await this.clerkClient.organizations.updateOrganizationMembership({
      organizationId,
      userId,
      role,
    });

    if (membership.publicUserData == null) {
      throw new Error("publicUserData is null");
    }

    return {
      id: membership.id,
      organizationId: membership.organization.id,
      userId: membership.publicUserData.userId,
      role: membership.role,
      createdAt: new Date(membership.createdAt),
      updatedAt: new Date(membership.updatedAt),
    };
  }

  async deleteOrganizationMembership(organizationId: string, userId: string): Promise<void> {
    await this.clerkClient.organizations.deleteOrganizationMembership({
      organizationId,
      userId,
    });
  }

  async createOrganizationInvitation(
    input: CreateInvitationInput,
  ): Promise<ClerkOrganizationInvitation> {
    const invitation = await this.clerkClient.organizations.createOrganizationInvitation({
      organizationId: input.organizationId,
      emailAddress: input.emailAddress,
      role: input.role,
      inviterUserId: input.inviterUserId,
      ...(input.redirectUrl && { redirectUrl: input.redirectUrl }),
    });

    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      status: (invitation.status ?? "revoked") as "pending" | "accepted" | "revoked" | "expired",
      createdAt: new Date(invitation.createdAt),
      updatedAt: new Date(invitation.updatedAt),
    };
  }

  async getOrganizationInvitationList(organizationId: string): Promise<{
    invitations: ClerkOrganizationInvitation[];
    totalCount: number;
  }> {
    const response = await this.clerkClient.organizations.getOrganizationInvitationList({
      organizationId,
    });

    return {
      invitations: response.data.map((invitation) => ({
        id: invitation.id,
        organizationId: invitation.organizationId,
        emailAddress: invitation.emailAddress,
        role: invitation.role,
        status: invitation.status as "pending" | "accepted" | "revoked" | "expired",
        createdAt: new Date(invitation.createdAt),
        updatedAt: new Date(invitation.updatedAt),
      })),
      totalCount: response.totalCount,
    };
  }

  async revokeOrganizationInvitation(
    organizationId: string,
    invitationId: string,
  ): Promise<ClerkOrganizationInvitation> {
    const invitation = await this.clerkClient.organizations.revokeOrganizationInvitation({
      organizationId,
      invitationId,
    });

    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      status: (invitation.status ?? "revoked") as "pending" | "accepted" | "revoked" | "expired",
      createdAt: new Date(invitation.createdAt),
      updatedAt: new Date(invitation.updatedAt),
    };
  }
}
