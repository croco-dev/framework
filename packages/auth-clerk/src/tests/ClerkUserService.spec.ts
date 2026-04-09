import { createClerkClient } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkUserService } from '../libs/ClerkUserService';

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(),
}));

describe('ClerkUserService', () => {
  let service!: ClerkUserService;
  let mockClerkClient!: ReturnType<typeof createClerkClient>;

  const options = { secretKey: 'sk_test_123', publishableKey: 'pk_test_123' };

  const createMockUser = (id: string) => ({
    id,
    firstName: 'John',
    lastName: 'Doe',
    emailAddresses: [{ id: 'ema_123', emailAddress: 'john@example.com', verification: { status: 'verified' } }],
    primaryEmailAddressId: 'ema_123',
    publicMetadata: { role: 'user' },
    privateMetadata: {},
    createdAt: 1678886400000,
    updatedAt: 1678886500000,
    banned: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockClerkClient = {
      users: {
        getUser: vi.fn(),
        getUserList: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        updateUserMetadata: vi.fn(),
        deleteUser: vi.fn(),
        banUser: vi.fn(),
        unbanUser: vi.fn(),
      },
    } as unknown as ReturnType<typeof createClerkClient>;

    vi.mocked(createClerkClient).mockReturnValue(mockClerkClient);
    service = new ClerkUserService(options);
  });

  describe('getUser', () => {
    it('should return user on success', async () => {
      const mockUser = createMockUser('user_123');
      vi.mocked(mockClerkClient.users.getUser).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.getUser>>
      );

      const result = await service.getUser('user_123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user_123');
      expect(result?.emailAddresses).toHaveLength(1);
    });

    it('should return null on error', async () => {
      vi.mocked(mockClerkClient.users.getUser).mockRejectedValue(new Error('User not found'));

      const result = await service.getUser('invalid-user');

      expect(result).toBeNull();
    });
  });

  describe('getUserList', () => {
    it('should return list of users', async () => {
      const mockResponse = {
        data: [createMockUser('user_1'), createMockUser('user_2')],
        totalCount: 2,
      };
      vi.mocked(mockClerkClient.users.getUserList).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof mockClerkClient.users.getUserList>>
      );

      const result = await service.getUserList({ limit: 10 });

      expect(result.users).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should pass all options to API', async () => {
      const mockResponse = {
        data: [],
        totalCount: 0,
      };
      vi.mocked(mockClerkClient.users.getUserList).mockResolvedValue(
        mockResponse as unknown as Awaited<ReturnType<typeof mockClerkClient.users.getUserList>>
      );

      await service.getUserList({
        limit: 10,
        offset: 5,
        orderBy: '-created_at',
        emailAddress: ['test@example.com'],
        query: 'john',
      });

      expect(mockClerkClient.users.getUserList).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        orderBy: '-created_at',
        emailAddress: ['test@example.com'],
        query: 'john',
      });
    });
  });

  describe('createUser', () => {
    it('should create user', async () => {
      const mockUser = createMockUser('user_new');
      vi.mocked(mockClerkClient.users.createUser).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.createUser>>
      );

      const result = await service.createUser({
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: ['john@example.com'],
        password: 'password123',
      });

      expect(result.id).toBe('user_new');
      expect(mockClerkClient.users.createUser).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: ['john@example.com'],
        password: 'password123',
      });
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      const mockUser = createMockUser('user_123');
      vi.mocked(mockClerkClient.users.updateUser).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.updateUser>>
      );

      const result = await service.updateUser('user_123', {
        firstName: 'Jane',
        publicMetadata: { role: 'admin' },
      });

      expect(result.id).toBe('user_123');
      expect(mockClerkClient.users.updateUser).toHaveBeenCalledWith('user_123', {
        firstName: 'Jane',
        publicMetadata: { role: 'admin' },
      });
    });
  });

  describe('updateUserMetadata', () => {
    it('should update user metadata', async () => {
      const mockUser = createMockUser('user_123');
      vi.mocked(mockClerkClient.users.updateUserMetadata).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.updateUserMetadata>>
      );

      await service.updateUserMetadata('user_123', {
        publicMetadata: { plan: 'premium' },
      });

      expect(mockClerkClient.users.updateUserMetadata).toHaveBeenCalledWith('user_123', {
        publicMetadata: { plan: 'premium' },
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const mockUser = createMockUser('user_123');
      vi.mocked(mockClerkClient.users.deleteUser).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.deleteUser>>
      );

      await service.deleteUser('user_123');

      expect(mockClerkClient.users.deleteUser).toHaveBeenCalledWith('user_123');
    });
  });

  describe('banUser', () => {
    it('should ban user', async () => {
      const bannedUser = { ...createMockUser('user_123'), banned: true };
      vi.mocked(mockClerkClient.users.banUser).mockResolvedValue(
        bannedUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.banUser>>
      );

      const result = await service.banUser('user_123');

      expect(result.banned).toBe(true);
      expect(mockClerkClient.users.banUser).toHaveBeenCalledWith('user_123');
    });
  });

  describe('unbanUser', () => {
    it('should unban user', async () => {
      const mockUser = createMockUser('user_123');
      vi.mocked(mockClerkClient.users.unbanUser).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof mockClerkClient.users.unbanUser>>
      );

      const result = await service.unbanUser('user_123');

      expect(result.banned).toBe(false);
      expect(mockClerkClient.users.unbanUser).toHaveBeenCalledWith('user_123');
    });
  });
});
