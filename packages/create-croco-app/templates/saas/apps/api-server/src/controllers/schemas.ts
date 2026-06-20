import { z } from "zod";

export const healthSchema = z.object({
  status: z.enum(["up", "down"]),
  results: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["up", "down"]),
      details: z.record(z.unknown()).optional(),
    }),
  ),
});

export const diagnosticsSchema = z.object({
  timestamp: z.string(),
  summary: z.enum(["all_healthy", "degraded", "issues_detected"]),
  components: z.array(
    z.object({
      status: z.enum(["healthy", "degraded", "unhealthy"]),
      component: z.string(),
      message: z.string().optional(),
      details: z.record(z.unknown()).optional(),
      lastChecked: z.string(),
    }),
  ),
  recentErrors: z.array(
    z.object({
      timestamp: z.string(),
      component: z.string(),
      code: z.string(),
      message: z.string(),
      cause: z.string().optional(),
    }),
  ),
});

export const saasDemoSnapshotSchema = z.object({
  contract: z.object({
    version: z.literal("saas-smoke-contract/v1"),
    providerProfile: z.string(),
  }),
  tenant: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    status: z.string(),
  }),
  invitation: z.object({
    status: z.string(),
    invitedUserId: z.string(),
  }),
  membership: z.object({
    ownerRole: z.string(),
    memberRole: z.string(),
    memberCount: z.number(),
    seatLimit: z.object({
      usage: z.number(),
      quota: z.number(),
      exceeded: z.boolean(),
      remaining: z.number(),
      failureCode: z.string(),
      rejectedUserId: z.string(),
    }),
  }),
  auth: z.object({
    permission: z.string(),
    allowed: z.boolean(),
  }),
  access: z.object({
    object: z.string(),
    relation: z.string(),
    allowed: z.boolean(),
  }),
  billing: z.object({
    checkoutUrl: z.string(),
    subscriptionStatus: z.string(),
    entitlementPlanId: z.string().nullable(),
  }),
  metering: z.object({
    meterId: z.string(),
    recordedValue: z.number(),
    currentUsage: z.number(),
  }),
  ai: z.object({
    provider: z.string().min(1),
    modelId: z.string().min(1),
    responseText: z.string().min(1),
    promptTokens: z.number().int().positive(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().positive(),
    costUsd: z.number().positive(),
    promptUsage: z.number().int().nonnegative(),
    promptQuota: z.number().int().positive(),
    quotaFailureCode: z.string().min(1),
  }),
  entitlement: z.object({
    featureKey: z.string(),
    granted: z.boolean(),
    quota: z.number().optional(),
    usage: z.number().optional(),
    remaining: z.number().optional(),
    planId: z.string().optional(),
  }),
  operations: z.object({
    healthStatus: z.enum(["up", "down"]),
    diagnosticsSummary: z.enum(["all_healthy", "degraded", "issues_detected"]),
  }),
  jobs: z.object({
    id: z.string(),
    type: z.string(),
    status: z.string(),
    failurePolicyState: z.string(),
    logCount: z.number(),
  }),
});

export type SaasDemoSnapshotDto = z.infer<typeof saasDemoSnapshotSchema>;

export const jobFailurePolicySchema = z.object({
  state: z.string(),
  needsAttention: z.boolean(),
  retryable: z.boolean(),
  replayable: z.boolean(),
  recoveryAction: z.string(),
  reason: z.string(),
});

export const jobSummarySchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  workflowName: z.string().optional(),
  attempts: z.number(),
  maxAttempts: z.number(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  replayOf: z.string().optional(),
  errorMessage: z.string().optional(),
  logCount: z.number(),
  failurePolicy: jobFailurePolicySchema,
});

export const jobLogEntrySchema = z.object({
  timestamp: z.string(),
  level: z.string(),
  message: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const jobDetailsSchema = jobSummarySchema.extend({
  payload: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  checkpoints: z.record(z.unknown()).optional(),
  progress: z.unknown().optional(),
  logs: z.array(jobLogEntrySchema),
});

export const jobListReportSchema = z.object({
  summary: z.enum(["healthy", "attention"]),
  generatedAt: z.string(),
  total: z.number(),
  attentionCount: z.number(),
  jobs: z.array(jobSummarySchema),
});

export const jobActionSchema = z.object({
  reason: z.string().optional(),
});

export const JOB_ID_SCHEMA = z.string().min(1);
export const OPTIONAL_JOB_STATUS_QUERY_SCHEMA = z.string().optional();
export const OPTIONAL_JOB_TYPE_QUERY_SCHEMA = z.string().optional();
export const OPTIONAL_JOBS_INTEGER_QUERY_SCHEMA = z.string().optional();

export type JobActionDto = z.infer<typeof jobActionSchema>;
