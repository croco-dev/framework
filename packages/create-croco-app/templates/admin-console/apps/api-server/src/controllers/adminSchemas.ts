import { z } from "zod";
import { CreditOperationsValidationProblem } from "@croco/admin-core";
import {
  CreditDuplicateConflictProblem,
  CreditEventPublicationProblem,
  StaleLedgerPositionProblem,
} from "@croco/credits-core";
import { ProblemCategory } from "@croco/problems-core";
import {
  defineRouteContract,
  defineRouteProblem,
  HttpMethod,
  RequestValidationProblem,
} from "@croco/protocols-rest";
import {
  AdminCreditOperationsPermissionDeniedProblem,
  AdminUserNotFoundProblem,
} from "../problems";

const adminUserNotFoundProblem = defineRouteProblem(AdminUserNotFoundProblem, {
  code: "admin-console/user-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested admin user does not exist in the selected tenant context.",
});

const creditOperationsRequestValidationProblem = defineRouteProblem(RequestValidationProblem, {
  code: "protocols-rest/request-validation-failed",
  category: ProblemCategory.ValidationError,
  description: "The credit operation request does not match the declared route schema.",
});

const creditOperationsValidationProblem = defineRouteProblem(CreditOperationsValidationProblem, {
  code: "admin-core/credit-operations-validation-failed",
  category: ProblemCategory.ValidationError,
  description: "The requested tenant credit operation failed semantic validation.",
});

const creditOperationsPermissionDeniedProblem = defineRouteProblem(
  AdminCreditOperationsPermissionDeniedProblem,
  {
    code: "admin-core/credit-operations-permission-denied",
    category: ProblemCategory.Forbidden,
    description: "The operator lacks a permission required for tenant credit operations.",
  },
);

const creditDuplicateConflictProblem = defineRouteProblem(CreditDuplicateConflictProblem, {
  code: "credits-core/duplicate-conflict",
  category: ProblemCategory.Conflict,
  description: "The idempotency key was already used for a different credit command.",
});

const staleLedgerPositionProblem = defineRouteProblem(StaleLedgerPositionProblem, {
  code: "credits-core/stale-ledger-position",
  category: ProblemCategory.Conflict,
  description: "The credit ledger advanced beyond the operator's expected position.",
});

const creditEventPublicationProblem = defineRouteProblem(CreditEventPublicationProblem, {
  code: "credits-core/event-publication-failed",
  category: ProblemCategory.InternalServerError,
  description: "The ledger committed but its post-commit event could not be published.",
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

const creditReferenceSchema = z.object({
  type: z.string(),
  value: z.string().optional(),
  maskedValue: z.string().optional(),
  visibility: z.enum(["visible", "masked", "denied"]),
  requiredPermissions: z.array(z.string()).optional(),
});

const creditAllocationSchema = z.object({
  grantTransactionId: z.string(),
  amount: z.string(),
});

const creditTransactionKindSchema = z.enum([
  "grant",
  "reserve",
  "commit",
  "release",
  "consume",
  "expire",
  "refund",
  "adjustment",
]);

const creditTransactionSchema = z.object({
  id: z.string(),
  position: z.number().int().nonnegative(),
  kind: creditTransactionKindSchema,
  amount: z.string(),
  occurredAt: z.string().datetime(),
  reference: creditReferenceSchema,
  allocations: z.array(creditAllocationSchema),
  reservationId: z.string().optional(),
  relatedTransactionId: z.string().optional(),
  meterKey: z.string().optional(),
  adjustmentDirection: z.enum(["credit", "debit"]).optional(),
  actorId: z.string().optional(),
  correlationId: z.string().optional(),
  refundableAmount: z.string().optional(),
});

const creditGrantLotSchema = z.object({
  transactionId: z.string(),
  amount: z.string(),
  remaining: z.string(),
  expiresAt: z.string().datetime().optional(),
  source: creditReferenceSchema.optional(),
  meterKeys: z.array(z.string()),
  status: z.enum(["available", "reserved", "consumed", "expired"]),
});

const creditReservationSchema = z.object({
  id: z.string(),
  amount: z.string(),
  status: z.enum(["active", "committed", "released"]),
  meterKey: z.string().optional(),
  allocations: z.array(creditAllocationSchema),
  createdAt: z.string().datetime(),
  settledAt: z.string().datetime().optional(),
  release: z
    .object({
      allowed: z.boolean(),
      reason: z.string(),
    })
    .optional(),
});

export const creditOperationsSnapshotSchema = z.object({
  tenantId: tenantIdSchema,
  accountId: z.string(),
  generatedAt: z.string().datetime(),
  balance: z.object({
    accountId: z.string(),
    ledgerPosition: z.number().int().nonnegative(),
    available: z.string(),
    reserved: z.string(),
    consumed: z.string(),
    expired: z.string(),
    lifetimeGranted: z.string(),
    netAdjusted: z.string(),
    expiringSoon: z.string(),
    expiringSoonBefore: z.string().datetime(),
  }),
  grantLots: z.array(creditGrantLotSchema),
  transactions: z.array(creditTransactionSchema),
  reservations: z.array(creditReservationSchema),
  history: z.union([
    z.object({ kind: z.literal("complete") }),
    z.object({
      kind: z.literal("partial"),
      earliestPosition: z.number().int().positive(),
      reason: z.string(),
    }),
  ]),
});

export const creditOperationsActionSchema = z.object({
  kind: z.enum(["grant", "refund", "release-reservation", "adjustment"]),
  targetId: z.string(),
  accountId: z.string(),
  tenantId: tenantIdSchema,
  ledgerPosition: z.number().int().nonnegative(),
  permission: z.string(),
  allowed: z.boolean(),
  reason: z.string(),
  auditEvent: z.string(),
  possibleProblems: z.array(z.string()),
});

const creditActionRequestBaseShape = {
  actorId: z.string(),
  reason: z.string(),
  idempotencyKey: z.string(),
  reference: z.object({ type: z.string(), id: z.string() }),
  expectedPosition: z.number().int().nonnegative(),
  tenantId: tenantIdSchema,
  accountId: z.string(),
  action: z.enum(["grant", "refund", "release-reservation", "adjustment"]),
  targetId: z.string(),
};

export const creditOperationsActionRequestSchema = z.object({
  ...creditActionRequestBaseShape,
  input: z.union([
    z.object({
      kind: z.literal("grant"),
      amount: z.string(),
      expiresAt: z.string().datetime().optional(),
      source: z.string().optional(),
      meterKeys: z.array(z.string()).optional(),
    }),
    z.object({
      kind: z.literal("refund"),
      consumptionTransactionId: z.string(),
      amount: z.string(),
    }),
    z.object({
      kind: z.literal("release-reservation"),
      reservationId: z.string(),
    }),
    z.object({
      kind: z.literal("adjustment"),
      direction: z.enum(["credit", "debit"]),
      amount: z.string(),
      expiresAt: z.string().datetime().optional(),
      source: z.string().optional(),
      meterKeys: z.array(z.string()).optional(),
    }),
  ]),
});

const adminProblemSchema = z.object({
  code: z.string(),
  status: z.number().int().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  retryable: z.boolean().optional(),
});

export const creditOperationsActionResultSchema = z.union([
  z.object({
    kind: z.literal("succeeded"),
    replayed: z.boolean(),
    ledgerPosition: z.number().int().nonnegative(),
    transactionIds: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("problem"),
    problem: adminProblemSchema,
    recovery: z.enum([
      "change-input",
      "refresh-ledger",
      "reuse-idempotency-result",
      "retry-event-publication",
    ]),
    ledgerCommitted: z.boolean().optional(),
  }),
]);

const creditOperationsActionCommandBaseShape = {
  targetId: z.string(),
  accountId: z.string(),
  tenantId: tenantIdSchema,
  actorId: z.string(),
  auditReason: z.string(),
  idempotencyKey: z.string(),
  referenceType: z.string(),
  referenceId: z.string(),
  expectedPosition: z.number().int().nonnegative(),
};

const creditOperationsActionCommandRouteSchema = z
  .object({
    ...creditOperationsActionCommandBaseShape,
    actionKind: z.enum(["grant", "refund", "release-reservation", "adjustment"]),
    inputKind: z.enum(["grant", "refund", "release-reservation", "adjustment"]),
    amount: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
    source: z.string().optional(),
    meterKeys: z.array(z.string()).optional(),
    consumptionTransactionId: z.string().optional(),
    reservationId: z.string().optional(),
    direction: z.enum(["credit", "debit"]).optional(),
  })
  .strict();

export const creditOperationsActionCommandSchema = z.discriminatedUnion("inputKind", [
  z
    .object({
      ...creditOperationsActionCommandBaseShape,
      actionKind: z.literal("grant"),
      inputKind: z.literal("grant"),
      amount: z.string(),
      expiresAt: z.string().datetime().optional(),
      source: z.string().optional(),
      meterKeys: z.array(z.string()).optional(),
    })
    .strict(),
  z
    .object({
      ...creditOperationsActionCommandBaseShape,
      actionKind: z.literal("refund"),
      inputKind: z.literal("refund"),
      amount: z.string(),
      consumptionTransactionId: z.string(),
    })
    .strict(),
  z
    .object({
      ...creditOperationsActionCommandBaseShape,
      actionKind: z.literal("release-reservation"),
      inputKind: z.literal("release-reservation"),
      reservationId: z.string(),
    })
    .strict(),
  z
    .object({
      ...creditOperationsActionCommandBaseShape,
      actionKind: z.literal("adjustment"),
      inputKind: z.literal("adjustment"),
      amount: z.string(),
      direction: z.enum(["credit", "debit"]),
      expiresAt: z.string().datetime().optional(),
      source: z.string().optional(),
      meterKeys: z.array(z.string()).optional(),
    })
    .strict(),
]);

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

export const adminCreditOperationsRoute = defineRouteContract({
  id: "admin.credits.snapshot",
  method: HttpMethod.GET,
  path: "/admin/credits",
  operationId: "getAdminCreditOperations",
  query: z.object({ tenantId: tenantIdSchema }),
  response: creditOperationsSnapshotSchema,
  problems: [creditOperationsValidationProblem, creditOperationsPermissionDeniedProblem],
});

export const adminExecuteCreditOperationRoute = defineRouteContract({
  id: "admin.credits.execute",
  method: HttpMethod.POST,
  path: "/admin/credits/actions",
  operationId: "executeAdminCreditOperation",
  body: creditOperationsActionCommandRouteSchema,
  response: creditOperationsActionResultSchema,
  problems: [
    creditOperationsRequestValidationProblem,
    creditOperationsValidationProblem,
    creditOperationsPermissionDeniedProblem,
    creditDuplicateConflictProblem,
    staleLedgerPositionProblem,
    creditEventPublicationProblem,
  ],
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserInputSchema>;
export type TenantSummary = z.infer<typeof tenantSummarySchema>;
export type AdminOperation = z.infer<typeof adminOperationSchema>;
export type AdminConsoleSnapshot = z.infer<typeof adminConsoleSnapshotSchema>;
export type CreditOperationsWireSnapshot = z.infer<typeof creditOperationsSnapshotSchema>;
export type CreditOperationsWireActionRequest = z.infer<typeof creditOperationsActionRequestSchema>;
export type CreditOperationsWireActionResult = z.infer<typeof creditOperationsActionResultSchema>;
export type CreditOperationsActionCommand = z.infer<typeof creditOperationsActionCommandSchema>;
