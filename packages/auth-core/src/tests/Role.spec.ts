import { beforeEach, describe, expect, it } from 'vitest';
import { RoleRegistry } from '../libs/rbac/Role';

describe('RoleRegistry', () => {
  let registry!: RoleRegistry;

  beforeEach(() => {
    registry = new RoleRegistry();
  });

  it('should register and retrieve a role', () => {
    const role = {
      name: 'admin',
      permissions: ['users:manage'],
    };
    registry.register(role);
    expect(registry.getRole('admin')).toBe(role);
  });

  it('should return undefined for non-existent role', () => {
    expect(registry.getRole('ghost')).toBeUndefined();
  });

  describe('getRolePermissions', () => {
    it('should return direct permissions', () => {
      registry.register({
        name: 'editor',
        permissions: ['posts:write', 'posts:read'],
      });
      const permissions = registry.getRolePermissions('editor');
      expect(permissions).toEqual(expect.arrayContaining(['posts:write', 'posts:read']));
      expect(permissions).toHaveLength(2);
    });

    it('should include inherited permissions', () => {
      registry.register({
        name: 'viewer',
        permissions: ['posts:read'],
      });
      registry.register({
        name: 'editor',
        permissions: ['posts:write'],
        inherits: ['viewer'],
      });

      const permissions = registry.getRolePermissions('editor');
      expect(permissions).toEqual(expect.arrayContaining(['posts:write', 'posts:read']));
    });

    it('should handle circular inheritance gracefully', () => {
      registry.register({
        name: 'roleA',
        permissions: ['perm:a'],
        inherits: ['roleB'],
      });
      registry.register({
        name: 'roleB',
        permissions: ['perm:b'],
        inherits: ['roleA'],
      });

      const permissionsA = registry.getRolePermissions('roleA');
      expect(permissionsA).toEqual(expect.arrayContaining(['perm:a', 'perm:b']));

      const permissionsB = registry.getRolePermissions('roleB');
      expect(permissionsB).toEqual(expect.arrayContaining(['perm:a', 'perm:b']));
    });

    it('should return empty array for non-existent role', () => {
      expect(registry.getRolePermissions('ghost')).toEqual([]);
    });

    it('should handle deep inheritance', () => {
      registry.register({ name: 'grandparent', permissions: ['gp:perm'] });
      registry.register({ name: 'parent', permissions: ['p:perm'], inherits: ['grandparent'] });
      registry.register({ name: 'child', permissions: ['c:perm'], inherits: ['parent'] });

      const permissions = registry.getRolePermissions('child');
      expect(permissions).toEqual(expect.arrayContaining(['gp:perm', 'p:perm', 'c:perm']));
    });
  });
});
