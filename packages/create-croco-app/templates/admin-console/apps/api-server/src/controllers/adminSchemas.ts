import { z } from "zod";

export const tenantIdSchema = z.string().min(1);

export const adminUserRoleSchema = z.enum(["owner", "admin", "viewer"]);
export const adminUserStatusSchema = z.enum(["active", "invited", "suspended"]);

export const adminUserSchema = z.object({
  id: z.string(),
  tenantId: tenantIdSchema,
  name: z.string(),
  email: z.string().email(),
  role: adminUserRoleSchema,
  status: adminUserStatusSchema,
  lastSeenAt: z.string(),
});

export const createAdminUserInputSchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string().min(1),
  email: z.string().email(),
  role: adminUserRoleSchema,
});

export const tenantSummarySchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string(),
  permissionMode: z.enum(["owner-managed", "support-managed"]),
});

export const adminOperationSchema = z.object({
  id: z.string(),
  tenantId: tenantIdSchema,
  resource: z.string(),
  action: z.string(),
  actor: z.string(),
  summary: z.string(),
  status: z.enum(["succeeded", "blocked", "needs-review"]),
  occurredAt: z.string(),
});

export const adminConsoleSnapshotSchema = z.object({
  tenant: tenantSummarySchema,
  users: z.array(adminUserSchema),
  operations: z.array(adminOperationSchema),
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserInputSchema>;
export type TenantSummary = z.infer<typeof tenantSummarySchema>;
export type AdminOperation = z.infer<typeof adminOperationSchema>;
export type AdminConsoleSnapshot = z.infer<typeof adminConsoleSnapshotSchema>;
