import { describe, expect, it } from 'vitest';
import type { Membership, MembershipCreateInput, MembershipRole, MembershipUpdateInput } from '../libs/types';

describe('Membership Types', () => {
  describe('MembershipRole', () => {
    it('should accept valid role values', () => {
      const owner: MembershipRole = 'owner';
      const admin: MembershipRole = 'admin';
      const member: MembershipRole = 'member';
      const viewer: MembershipRole = 'viewer';

      expect(owner).toBe('owner');
      expect(admin).toBe('admin');
      expect(member).toBe('member');
      expect(viewer).toBe('viewer');
    });

    it('should have exact 4 role values', () => {
      const roles: MembershipRole[] = ['owner', 'admin', 'member', 'viewer'];
      expect(roles).toHaveLength(4);
    });
  });

  describe('Membership', () => {
    it('should accept valid membership object', () => {
      const membership: Membership = {
        id: 'mem_123',
        tenantId: 'tenant_456',
        userId: 'user_789',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(membership.id).toBe('mem_123');
      expect(membership.role).toBe('admin');
    });

    it('should require all required fields', () => {
      // @ts-expect-error - missing id field
      void {
        tenantId: 'tenant_456',
        userId: 'user_789',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Membership;

      // @ts-expect-error - missing tenantId field
      void {
        id: 'mem_123',
        userId: 'user_789',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Membership;
    });
  });

  describe('MembershipCreateInput', () => {
    it('should accept valid create input', () => {
      const input: MembershipCreateInput = {
        id: 'mem_123',
        tenantId: 'tenant_456',
        userId: 'user_789',
        role: 'member',
      };

      expect(input.role).toBe('member');
    });
  });

  describe('MembershipUpdateInput', () => {
    it('should accept valid update input', () => {
      const input: MembershipUpdateInput = {
        role: 'owner',
      };

      expect(input.role).toBe('owner');
    });
  });
});
