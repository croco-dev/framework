import { type ClerkClient, createClerkClient } from "@clerk/backend";
import type { ClerkAuthOptions } from "./ClerkAuthProvider";
import { executeClerkLookup, executeClerkOperation } from "./clerkOperation";

export type ClerkUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verified: boolean;
  }>;
  primaryEmailAddressId: string | null;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  banned: boolean;
};

export type CreateClerkUserInput = {
  firstName?: string;
  lastName?: string;
  emailAddress: string[];
  password?: string;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
};

export type UpdateClerkUserInput = {
  firstName?: string;
  lastName?: string;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
};

export type UserListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: "-created_at" | "created_at" | "-updated_at" | "updated_at";
  emailAddress?: string[];
  query?: string;
};

export type UserListResult = {
  users: ClerkUser[];
  totalCount: number;
};

function mapClerkUser(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification: { status: string } | null;
  }>;
  primaryEmailAddressId: string | null;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  banned: boolean;
}): ClerkUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    emailAddresses: user.emailAddresses.map((email) => ({
      id: email.id,
      emailAddress: email.emailAddress,
      verified: email.verification?.status === "verified",
    })),
    primaryEmailAddressId: user.primaryEmailAddressId,
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    banned: user.banned,
  };
}

export class ClerkUserService {
  private clerkClient: ClerkClient;

  constructor(options: ClerkAuthOptions) {
    this.clerkClient = createClerkClient({
      secretKey: options.secretKey,
      publishableKey: options.publishableKey,
    });
  }

  async getUser(userId: string): Promise<ClerkUser | null> {
    const user = await executeClerkLookup("users.getUser", () =>
      this.clerkClient.users.getUser(userId),
    );
    if (user === null) {
      return null;
    }

    return mapClerkUser(user);
  }

  async getUserList(options: UserListOptions = {}): Promise<UserListResult> {
    const params: Record<string, string | number | string[]> = {};

    if (options.limit !== undefined) {
      params.limit = options.limit;
    }
    if (options.offset !== undefined) {
      params.offset = options.offset;
    }
    if (options.orderBy) {
      params.orderBy = options.orderBy;
    }
    if (options.emailAddress) {
      params.emailAddress = options.emailAddress;
    }
    if (options.query) {
      params.query = options.query;
    }

    const response = await executeClerkOperation("users.getUserList", () =>
      this.clerkClient.users.getUserList(params),
    );

    return {
      users: response.data.map(mapClerkUser),
      totalCount: response.totalCount,
    };
  }

  async createUser(input: CreateClerkUserInput): Promise<ClerkUser> {
    const user = await executeClerkOperation("users.createUser", () =>
      this.clerkClient.users.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        emailAddress: input.emailAddress,
        ...(input.password && { password: input.password }),
        ...(input.publicMetadata && { publicMetadata: input.publicMetadata }),
        ...(input.privateMetadata && { privateMetadata: input.privateMetadata }),
      }),
    );

    return mapClerkUser(user);
  }

  async updateUser(userId: string, input: UpdateClerkUserInput): Promise<ClerkUser> {
    const user = await executeClerkOperation("users.updateUser", () =>
      this.clerkClient.users.updateUser(userId, {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.publicMetadata !== undefined && {
          publicMetadata: input.publicMetadata,
        }),
        ...(input.privateMetadata !== undefined && {
          privateMetadata: input.privateMetadata,
        }),
      }),
    );

    return mapClerkUser(user);
  }

  async updateUserMetadata(
    userId: string,
    metadata: {
      publicMetadata?: Record<string, unknown>;
      privateMetadata?: Record<string, unknown>;
    },
  ): Promise<ClerkUser> {
    const user = await executeClerkOperation("users.updateUserMetadata", () =>
      this.clerkClient.users.updateUserMetadata(userId, {
        ...(metadata.publicMetadata && {
          publicMetadata: metadata.publicMetadata,
        }),
        ...(metadata.privateMetadata && {
          privateMetadata: metadata.privateMetadata,
        }),
      }),
    );

    return mapClerkUser(user);
  }

  async deleteUser(userId: string): Promise<void> {
    await executeClerkOperation("users.deleteUser", () =>
      this.clerkClient.users.deleteUser(userId),
    );
  }

  async banUser(userId: string): Promise<ClerkUser> {
    const user = await executeClerkOperation("users.banUser", () =>
      this.clerkClient.users.banUser(userId),
    );
    return mapClerkUser(user);
  }

  async unbanUser(userId: string): Promise<ClerkUser> {
    const user = await executeClerkOperation("users.unbanUser", () =>
      this.clerkClient.users.unbanUser(userId),
    );
    return mapClerkUser(user);
  }
}
