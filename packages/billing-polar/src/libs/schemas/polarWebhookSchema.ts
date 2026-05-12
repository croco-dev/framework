import { z } from "zod";

export const PolarEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const PolarCustomerSchema = z.object({
  externalId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const PolarProductSchema = z.object({
  id: z.string().optional(),
});

export const PolarSubscriptionDataSchema = z
  .object({
    id: z.string(),
    status: z.enum(["active", "past_due", "canceled", "revoked", "trialing"]),
    customer: PolarCustomerSchema.optional(),
    product: PolarProductSchema.optional(),
    currentPeriodEnd: z.union([z.string(), z.date()]).nullable().optional(),
    cancelAtPeriodEnd: z.boolean().nullable().optional(),
  })
  .passthrough();

export const PolarOrderDataSchema = z
  .object({
    id: z.string(),
    amount: z.number().finite().positive().optional(),
    currency: z.string().length(3).optional(),
    createdAt: z.union([z.string(), z.date()]).nullable().optional(),
    customer: PolarCustomerSchema.optional(),
  })
  .passthrough();

export type PolarEvent = z.infer<typeof PolarEventSchema>;
export type PolarSubscriptionData = z.infer<typeof PolarSubscriptionDataSchema>;
export type PolarOrderData = z.infer<typeof PolarOrderDataSchema>;
