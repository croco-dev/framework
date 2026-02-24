import { z } from 'zod';

export const PolarEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const PolarSubscriptionDataSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    customer: z
      .object({
        externalId: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .optional(),
    product: z
      .object({
        id: z.string().optional(),
      })
      .optional(),
    currentPeriodEnd: z.union([z.string(), z.date()]).nullable().optional(),
    cancelAtPeriodEnd: z.unknown(),
  })
  .passthrough();

export const PolarOrderDataSchema = z
  .object({
    id: z.string(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]).nullable().optional(),
    customer: z
      .object({
        externalId: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .optional(),
  })
  .passthrough();

export type PolarEvent = z.infer<typeof PolarEventSchema>;
export type PolarSubscriptionData = z.infer<typeof PolarSubscriptionDataSchema>;
export type PolarOrderData = z.infer<typeof PolarOrderDataSchema>;
