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
  }),
  metering: z.object({
    meterId: z.string(),
    recordedValue: z.number(),
    currentUsage: z.number(),
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
});

export type SaasDemoSnapshotDto = z.infer<typeof saasDemoSnapshotSchema>;
