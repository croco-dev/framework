import { createClerkClient } from "@clerk/backend";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkOrganizationService } from "../libs/ClerkOrganizationService";
import {
  ClerkExternalServiceProblem,
  ClerkPublicUserDataMissingProblem,
} from "../libs/problems/ClerkProblems";

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(),
}));

describe("ClerkOrganizationService", () => {
  let service!: ClerkOrganizationService;
  let mockClerkClient!: ReturnType<typeof createClerkClient>;

  const options = { secretKey: "sk_test_123", publishableKey: "pk_test_123" };

  const createMockOrg = (id: string) => ({
    id,
    name: "Test Org",
    slug: "test-org",
    maxAllowedMemberships: 100,
    adminDeleteEnabled: true,
    publicMetadata: {},
    privateMetadata: {},
    createdAt: 1678886400000,
    updatedAt: 1678886500000,
  });

  const createMockMembership = (id: string) => ({
    id,
    organization: { id: "org_123", name: "Test Org" },
    publicUserData: { userId: "user_123", firstName: "John", lastName: "Doe" },
    role: "org:member",
    createdAt: 1678886400000,
    updatedAt: 1678886500000,
  });

  const createMockInvitation = (id: string) => ({
    id,
    organizationId: "org_123",
    emailAddress: "invite@example.com",
    role: "org:member",
    status: "pending",
    createdAt: 1678886400000,
    updatedAt: 1678886500000,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockClerkClient = {
      organizations: {
        getOrganization: vi.fn(),
        getOrganizationList: vi.fn(),
        createOrganization: vi.fn(),
        updateOrganization: vi.fn(),
        deleteOrganization: vi.fn(),
        getOrganizationMembershipList: vi.fn(),
        createOrganizationMembership: vi.fn(),
        updateOrganizationMembership: vi.fn(),
        deleteOrganizationMembership: vi.fn(),
        createOrganizationInvitation: vi.fn(),
        getOrganizationInvitationList: vi.fn(),
        revokeOrganizationInvitation: vi.fn(),
      },
    } as unknown as ReturnType<typeof createClerkClient>;

    vi.mocked(createClerkClient).mockReturnValue(mockClerkClient);
    service = new ClerkOrganizationService(options);
  });

  describe("getOrganization", () => {
    it("should return organization on success", async () => {
      const mockOrg = createMockOrg("org_123");
      vi.mocked(mockClerkClient.organizations.getOrganization).mockResolvedValue(
        mockOrg as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.getOrganization>
        >,
      );

      const result = await service.getOrganization("org_123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("org_123");
      expect(result?.name).toBe("Test Org");
    });

    it("should return null on not found error", async () => {
      vi.mocked(mockClerkClient.organizations.getOrganization).mockRejectedValue(
        new Error("Org not found"),
      );

      const result = await service.getOrganization("invalid-org");

      expect(result).toBeNull();
    });

    it("should return null on 404 Clerk error", async () => {
      const clerkError = { status: 404, message: "Organization not found" };
      vi.mocked(mockClerkClient.organizations.getOrganization).mockRejectedValue(clerkError);

      const result = await service.getOrganization("invalid-org");

      expect(result).toBeNull();
    });

    it("should throw ClerkExternalServiceProblem on permission failure", async () => {
      const clerkError = { status: 403, message: "Forbidden" };
      vi.mocked(mockClerkClient.organizations.getOrganization).mockRejectedValue(clerkError);

      await expect(service.getOrganization("org_123")).rejects.toThrow(ClerkExternalServiceProblem);
    });

    it("should throw ClerkExternalServiceProblem on network error", async () => {
      const networkError = new Error("Network connection failed");
      vi.mocked(mockClerkClient.organizations.getOrganization).mockRejectedValue(networkError);

      await expect(service.getOrganization("org_123")).rejects.toThrow(ClerkExternalServiceProblem);
    });
  });

  describe("getOrganizationBySlug", () => {
    it("should return organization by slug", async () => {
      const mockOrg = createMockOrg("org_123");
      vi.mocked(mockClerkClient.organizations.getOrganization).mockResolvedValue(
        mockOrg as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.getOrganization>
        >,
      );

      const result = await service.getOrganizationBySlug("test-org");

      expect(result).not.toBeNull();
      expect(mockClerkClient.organizations.getOrganization).toHaveBeenCalledWith({
        slug: "test-org",
      });
    });

    it("should throw ClerkExternalServiceProblem on non-404 Clerk error", async () => {
      const clerkError = { statusCode: 500, message: "Internal server error" };
      vi.mocked(mockClerkClient.organizations.getOrganization).mockRejectedValue(clerkError);

      await expect(service.getOrganizationBySlug("test-org")).rejects.toThrow(
        ClerkExternalServiceProblem,
      );
    });
  });

  describe("getOrganizationList", () => {
    it("should return list of organizations", async () => {
      const mockResponse = {
        data: [createMockOrg("org_1"), createMockOrg("org_2")],
        totalCount: 2,
      };
      vi.mocked(mockClerkClient.organizations.getOrganizationList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.getOrganizationList>
        >,
      );

      const result = await service.getOrganizationList({ limit: 10 });

      expect(result.organizations).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });
  });

  describe("createOrganization", () => {
    it("should create organization", async () => {
      const mockOrg = createMockOrg("org_new");
      vi.mocked(mockClerkClient.organizations.createOrganization).mockResolvedValue(
        mockOrg as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.createOrganization>
        >,
      );

      const result = await service.createOrganization({
        name: "New Org",
        createdBy: "user_123",
        slug: "new-org",
        maxAllowedMemberships: 50,
      });

      expect(result.id).toBe("org_new");
      expect(mockClerkClient.organizations.createOrganization).toHaveBeenCalledWith({
        name: "New Org",
        createdBy: "user_123",
        slug: "new-org",
        maxAllowedMemberships: 50,
      });
    });

    it("should classify terminal mutation failures without exposing SDK details", async () => {
      vi.mocked(mockClerkClient.organizations.createOrganization).mockRejectedValue({
        statusCode: 403,
        message: "Forbidden token=clerk_request_token",
        requestId: "req_private",
      });

      await expect(
        service.createOrganization({ name: "New Org", createdBy: "user_123" }),
      ).rejects.toMatchObject({
        code: "auth-clerk/external-service-error",
        detail: "Clerk operation 'organizations.createOrganization' failed",
        extensions: {
          operation: "organizations.createOrganization",
          provider: "clerk",
          retryable: false,
          upstreamStatus: 403,
        },
      });
    });
  });

  describe("updateOrganization", () => {
    it("should update organization", async () => {
      const mockOrg = { ...createMockOrg("org_123"), name: "Updated Org" };
      vi.mocked(mockClerkClient.organizations.updateOrganization).mockResolvedValue(
        mockOrg as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.updateOrganization>
        >,
      );

      const result = await service.updateOrganization("org_123", {
        name: "Updated Org",
        publicMetadata: { plan: "premium" },
      });

      expect(result.name).toBe("Updated Org");
      expect(mockClerkClient.organizations.updateOrganization).toHaveBeenCalledWith("org_123", {
        name: "Updated Org",
        publicMetadata: { plan: "premium" },
      });
    });
  });

  describe("deleteOrganization", () => {
    it("should delete organization", async () => {
      vi.mocked(mockClerkClient.organizations.deleteOrganization).mockResolvedValue(
        {} as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.deleteOrganization>
        >,
      );

      await service.deleteOrganization("org_123");

      expect(mockClerkClient.organizations.deleteOrganization).toHaveBeenCalledWith("org_123");
    });
  });

  describe("getOrganizationMembershipList", () => {
    it("should return memberships", async () => {
      const mockResponse = {
        data: [createMockMembership("mem_1")],
        totalCount: 1,
      };
      vi.mocked(mockClerkClient.organizations.getOrganizationMembershipList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.getOrganizationMembershipList>
        >,
      );

      const result = await service.getOrganizationMembershipList("org_123");

      expect(result.memberships).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.memberships[0].role).toBe("org:member");
    });

    it("should count only memberships with public user data", async () => {
      const mockResponse = {
        data: [
          createMockMembership("mem_1"),
          { ...createMockMembership("mem_missing"), publicUserData: null },
        ],
        totalCount: 2,
      };
      vi.mocked(mockClerkClient.organizations.getOrganizationMembershipList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.getOrganizationMembershipList>
        >,
      );

      const result = await service.getOrganizationMembershipList("org_123");

      expect(result.memberships).toHaveLength(1);
      expect(result.totalCount).toBe(result.memberships.length);
    });
  });

  describe("createOrganizationMembership", () => {
    it("should create membership", async () => {
      const mockMembership = createMockMembership("mem_new");
      vi.mocked(mockClerkClient.organizations.createOrganizationMembership).mockResolvedValue(
        mockMembership as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.createOrganizationMembership>
        >,
      );

      const result = await service.createOrganizationMembership({
        organizationId: "org_123",
        userId: "user_456",
        role: "org:admin",
      });

      expect(result.id).toBe("mem_new");
      expect(mockClerkClient.organizations.createOrganizationMembership).toHaveBeenCalledWith({
        organizationId: "org_123",
        userId: "user_456",
        role: "org:admin",
      });
    });

    it("throws a Problem when Clerk omits public user data", async () => {
      const mockMembership = { ...createMockMembership("mem_missing"), publicUserData: null };
      vi.mocked(mockClerkClient.organizations.createOrganizationMembership).mockResolvedValue(
        mockMembership as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.createOrganizationMembership>
        >,
      );

      const result = service.createOrganizationMembership({
        organizationId: "org_123",
        userId: "user_456",
        role: "org:admin",
      });

      await expect(result).rejects.toBeInstanceOf(ClerkPublicUserDataMissingProblem);
      await expect(result).rejects.toMatchObject({
        code: "auth-clerk/public-user-data-missing",
        category: ProblemCategory.InternalServerError,
      });
    });
  });

  describe("updateOrganizationMembership", () => {
    it("should update membership role", async () => {
      const mockMembership = { ...createMockMembership("mem_123"), role: "org:admin" };
      vi.mocked(mockClerkClient.organizations.updateOrganizationMembership).mockResolvedValue(
        mockMembership as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.updateOrganizationMembership>
        >,
      );

      const result = await service.updateOrganizationMembership("org_123", "user_456", "org:admin");

      expect(result.role).toBe("org:admin");
      expect(mockClerkClient.organizations.updateOrganizationMembership).toHaveBeenCalledWith({
        organizationId: "org_123",
        userId: "user_456",
        role: "org:admin",
      });
    });

    it("throws a Problem when Clerk omits public user data", async () => {
      const mockMembership = { ...createMockMembership("mem_missing"), publicUserData: null };
      vi.mocked(mockClerkClient.organizations.updateOrganizationMembership).mockResolvedValue(
        mockMembership as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.updateOrganizationMembership>
        >,
      );

      const result = service.updateOrganizationMembership("org_123", "user_456", "org:admin");

      await expect(result).rejects.toBeInstanceOf(ClerkPublicUserDataMissingProblem);
      await expect(result).rejects.toMatchObject({
        code: "auth-clerk/public-user-data-missing",
        category: ProblemCategory.InternalServerError,
      });
    });
  });

  describe("deleteOrganizationMembership", () => {
    it("should delete membership", async () => {
      vi.mocked(mockClerkClient.organizations.deleteOrganizationMembership).mockResolvedValue(
        {} as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.deleteOrganizationMembership>
        >,
      );

      await service.deleteOrganizationMembership("org_123", "user_456");

      expect(mockClerkClient.organizations.deleteOrganizationMembership).toHaveBeenCalledWith({
        organizationId: "org_123",
        userId: "user_456",
      });
    });
  });

  describe("createOrganizationInvitation", () => {
    it("should create invitation", async () => {
      const mockInvitation = createMockInvitation("inv_new");
      vi.mocked(mockClerkClient.organizations.createOrganizationInvitation).mockResolvedValue(
        mockInvitation as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.createOrganizationInvitation>
        >,
      );

      const result = await service.createOrganizationInvitation({
        organizationId: "org_123",
        emailAddress: "new@example.com",
        role: "org:member",
        inviterUserId: "user_123",
      });

      expect(result.id).toBe("inv_new");
      expect(mockClerkClient.organizations.createOrganizationInvitation).toHaveBeenCalledWith({
        organizationId: "org_123",
        emailAddress: "new@example.com",
        role: "org:member",
        inviterUserId: "user_123",
      });
    });
  });

  describe("getOrganizationInvitationList", () => {
    it("should return invitations", async () => {
      const mockResponse = {
        data: [createMockInvitation("inv_1")],
        totalCount: 1,
      };
      vi.mocked(mockClerkClient.organizations.getOrganizationInvitationList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.getOrganizationInvitationList>
        >,
      );

      const result = await service.getOrganizationInvitationList("org_123");

      expect(result.invitations).toHaveLength(1);
      expect(result.invitations[0].status).toBe("pending");
    });
  });

  describe("revokeOrganizationInvitation", () => {
    it("should revoke invitation", async () => {
      const mockInvitation = { ...createMockInvitation("inv_123"), status: "revoked" };
      vi.mocked(mockClerkClient.organizations.revokeOrganizationInvitation).mockResolvedValue(
        mockInvitation as unknown as Awaited<
          ReturnType<typeof mockClerkClient.organizations.revokeOrganizationInvitation>
        >,
      );

      const result = await service.revokeOrganizationInvitation("org_123", "inv_123");

      expect(result.status).toBe("revoked");
      expect(mockClerkClient.organizations.revokeOrganizationInvitation).toHaveBeenCalledWith({
        organizationId: "org_123",
        invitationId: "inv_123",
      });
    });
  });
});
