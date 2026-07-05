import { z } from "zod";
import { ProblemCategory } from "@croco/problems-core";
import { defineRouteContract, defineRouteProblem, HttpMethod } from "@croco/protocols-rest";
import { AdminUserNotFoundProblem } from "../problems";

const adminUserNotFoundProblem = defineRouteProblem(AdminUserNotFoundProblem, {
  code: "admin-console/user-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested admin user does not exist in the selected tenant context.",
});

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

const tenantQuerySchema = z.object({
  tenantId: tenantIdSchema.optional(),
});

export const adminSnapshotRoute = defineRouteContract({
  id: "admin.snapshot",
  method: HttpMethod.GET,
  path: "/admin/snapshot",
  operationId: "getAdminSnapshot",
  query: tenantQuerySchema,
  response: adminConsoleSnapshotSchema,
  problems: [],
});

export const adminListUsersRoute = defineRouteContract({
  id: "admin.users.list",
  method: HttpMethod.GET,
  path: "/admin/users",
  operationId: "listAdminUsers",
  query: tenantQuerySchema,
  response: z.array(adminUserSchema),
  problems: [],
});

export const adminGetUserRoute = defineRouteContract({
  id: "admin.users.get",
  method: HttpMethod.GET,
  path: "/admin/users/:id",
  operationId: "getAdminUser",
  params: z.object({ id: z.string().min(1) }),
  query: tenantQuerySchema,
  response: adminUserSchema,
  problems: [adminUserNotFoundProblem],
});

export const adminCreateUserRoute = defineRouteContract({
  id: "admin.users.create",
  method: HttpMethod.POST,
  path: "/admin/users",
  operationId: "createAdminUser",
  body: createAdminUserInputSchema,
  response: adminUserSchema,
  problems: [],
});

export const adminListOperationsRoute = defineRouteContract({
  id: "admin.operations.list",
  method: HttpMethod.GET,
  path: "/admin/operations",
  operationId: "listAdminOperations",
  query: tenantQuerySchema,
  response: z.array(adminOperationSchema),
  problems: [],
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserInputSchema>;
export type TenantSummary = z.infer<typeof tenantSummarySchema>;
export type AdminOperation = z.infer<typeof adminOperationSchema>;
export type AdminConsoleSnapshot = z.infer<typeof adminConsoleSnapshotSchema>;
