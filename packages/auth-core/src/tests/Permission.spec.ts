import { describe, expect, it } from 'vitest';
import { formatPermission, hasPermission, parsePermission } from '../libs/rbac/Permission';

describe('Permission', () => {
  describe('parsePermission', () => {
    it('should parse valid permission string', () => {
      const result = parsePermission('billing:write');
      expect(result).toEqual({ resource: 'billing', action: 'write' });
    });

    it('should throw error for invalid format', () => {
      expect(() => parsePermission('invalid')).toThrow('Invalid permission format');
    });

    it('should throw error for invalid action', () => {
      expect(() => parsePermission('billing:invalid_action')).toThrow('Invalid permission action');
    });

    it('should parse manage action', () => {
      const result = parsePermission('users:manage');
      expect(result).toEqual({ resource: 'users', action: 'manage' });
    });
  });

  describe('formatPermission', () => {
    it('should format permission object to string', () => {
      const permission = { resource: 'billing', action: 'write' as const };
      expect(formatPermission(permission)).toBe('billing:write');
    });
  });

  describe('hasPermission', () => {
    it('should return true for exact match', () => {
      const userPermissions = ['billing:read', 'billing:write'];
      expect(hasPermission(userPermissions, 'billing:write')).toBe(true);
    });

    it('should return true when user has manage permission', () => {
      const userPermissions = ['billing:manage'];
      expect(hasPermission(userPermissions, 'billing:write')).toBe(true);
      expect(hasPermission(userPermissions, 'billing:read')).toBe(true);
      expect(hasPermission(userPermissions, 'billing:delete')).toBe(true);
    });

    it('should return false for mismatch', () => {
      const userPermissions = ['billing:read'];
      expect(hasPermission(userPermissions, 'billing:write')).toBe(false);
    });

    it('should return false for different resource', () => {
      const userPermissions = ['users:write'];
      expect(hasPermission(userPermissions, 'billing:write')).toBe(false);
    });

    it('should handle invalid permissions in user list gracefully', () => {
      const userPermissions = ['invalid:permission', 'billing:write'];
      // 'invalid:permission' will cause parsePermission to throw inside hasPermission's loop
      // The implementation catches this error and returns false for that item
      expect(hasPermission(userPermissions, 'billing:write')).toBe(true);
    });
  });
});
