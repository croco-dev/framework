import { z } from "zod";
import { ProblemCategory } from "@croco/problems-core";
import { defineRouteContract, defineRouteProblem, HttpMethod } from "@croco/protocols-rest";
import {
  DemoEndpointDisabledProblem,
  InvalidJobsQueryProblem,
  JobNotFoundProblem,
  SaasDemoSmokeProblem,
  TenantAlreadyExistsProblem,
  TenantNotFoundProblem,
} from "../problems";

const demoEndpointDisabledProblem = defineRouteProblem(DemoEndpointDisabledProblem, {
  code: "saas-demo/demo-endpoint-disabled",
  category: ProblemCategory.Forbidden,
  description: "Demo endpoints are disabled for this environment.",
});
const invalidJobsQueryProblem = defineRouteProblem(InvalidJobsQueryProblem, {
  code: "saas-demo/invalid-jobs-query",
  category: ProblemCategory.ValidationError,
  description: "A jobs query parameter is invalid.",
});
const jobNotFoundProblem = defineRouteProblem(JobNotFoundProblem, {
  code: "saas-demo/job-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested job does not exist.",
});
const tenantAlreadyExistsProblem = defineRouteProblem(TenantAlreadyExistsProblem, {
  code: "saas-demo/tenant-already-exists",
  category: ProblemCategory.Conflict,
  description: "The demo tenant already exists.",
});
const tenantNotFoundProblem = defineRouteProblem(TenantNotFoundProblem, {
  code: "saas-demo/tenant-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested tenant does not exist.",
});
const saasDemoSmokeProblem = defineRouteProblem(SaasDemoSmokeProblem, {
  code: "saas-demo/smoke-failed",
  category: ProblemCategory.InternalServerError,
  description: "The SaaS demo smoke flow failed.",
});

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
    userId: z.string(),
    sessionId: z.string(),
    roles: z.array(z.string()),
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
    mockEvent: z.object({
      eventId: z.string(),
      eventType: z.string(),
      externalSubscriptionId: z.string(),
      planVersionRef: z.string(),
      processedStatus: z.literal("completed"),
      duplicateFailureCode: z.string(),
    }),
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
  lifecycle: z.object({
    ruleId: z.string(),
    firstRunStatus: z.string(),
    duplicateRunStatus: z.string(),
    duplicateSkipReason: z.string(),
    emittedActionType: z.string(),
    emittedActionCount: z.number(),
    visibleRunCount: z.number(),
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

const jobsListQuerySchema = z.object({
  status: OPTIONAL_JOB_STATUS_QUERY_SCHEMA,
  type: OPTIONAL_JOB_TYPE_QUERY_SCHEMA,
  replayOf: OPTIONAL_JOB_TYPE_QUERY_SCHEMA,
  limit: OPTIONAL_JOBS_INTEGER_QUERY_SCHEMA,
  offset: OPTIONAL_JOBS_INTEGER_QUERY_SCHEMA,
});
const jobIdParamsSchema = z.object({
  id: JOB_ID_SCHEMA,
});
const saasDemoProblems = [
  demoEndpointDisabledProblem,
  tenantAlreadyExistsProblem,
  tenantNotFoundProblem,
  saasDemoSmokeProblem,
] as const;

export const healthRoute = defineRouteContract({
  id: "operations.health",
  method: HttpMethod.GET,
  path: "/ops/health",
  operationId: "getOperationsHealth",
  response: healthSchema,
  problems: [],
});

export const diagnosticsRoute = defineRouteContract({
  id: "operations.diagnostics",
  method: HttpMethod.GET,
  path: "/ops/diagnostics",
  operationId: "getOperationsDiagnostics",
  response: diagnosticsSchema,
  problems: [],
});

export const listJobsRoute = defineRouteContract({
  id: "jobs.list",
  method: HttpMethod.GET,
  path: "/ops/jobs",
  operationId: "listJobs",
  query: jobsListQuerySchema,
  response: jobListReportSchema,
  problems: [invalidJobsQueryProblem],
});

export const showJobRoute = defineRouteContract({
  id: "jobs.show",
  method: HttpMethod.GET,
  path: "/ops/jobs/:id",
  operationId: "showJob",
  params: jobIdParamsSchema,
  response: jobDetailsSchema,
  problems: [jobNotFoundProblem],
});

export const jobLogsRoute = defineRouteContract({
  id: "jobs.logs",
  method: HttpMethod.GET,
  path: "/ops/jobs/:id/logs",
  operationId: "listJobLogs",
  params: jobIdParamsSchema,
  response: jobLogEntrySchema.array(),
  problems: [jobNotFoundProblem],
});

export const cancelJobRoute = defineRouteContract({
  id: "jobs.cancel",
  method: HttpMethod.POST,
  path: "/ops/jobs/:id/cancel",
  operationId: "cancelJob",
  params: jobIdParamsSchema,
  body: jobActionSchema,
  response: jobDetailsSchema,
  problems: [jobNotFoundProblem],
});

export const replayJobRoute = defineRouteContract({
  id: "jobs.replay",
  method: HttpMethod.POST,
  path: "/ops/jobs/:id/replay",
  operationId: "replayJob",
  params: jobIdParamsSchema,
  body: jobActionSchema,
  response: jobDetailsSchema,
  problems: [jobNotFoundProblem],
});

export const seedSaasDemoRoute = defineRouteContract({
  id: "saas.demo.seed",
  method: HttpMethod.POST,
  path: "/saas/demo/seed",
  operationId: "seedSaasDemo",
  response: saasDemoSnapshotSchema,
  problems: saasDemoProblems,
});

export const smokeSaasDemoRoute = defineRouteContract({
  id: "saas.demo.smoke",
  method: HttpMethod.GET,
  path: "/saas/demo/smoke",
  operationId: "smokeSaasDemo",
  response: saasDemoSnapshotSchema,
  problems: saasDemoProblems,
});

export type JobActionDto = z.infer<typeof jobActionSchema>;
