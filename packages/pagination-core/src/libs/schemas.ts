import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_OFFSET } from "./constants";
import { normalizePaginationLimit, normalizePaginationOffset } from "./normalizePaginationNumber";

const PaginationLimitSchema = z.coerce
  .number()
  .overwrite(normalizePaginationLimit)
  .int()
  .min(MIN_LIMIT)
  .max(MAX_LIMIT)
  .catch(DEFAULT_LIMIT)
  .default(DEFAULT_LIMIT);

const PaginationOffsetSchema = z.coerce
  .number()
  .overwrite(normalizePaginationOffset)
  .int()
  .min(MIN_OFFSET)
  .catch(MIN_OFFSET)
  .default(MIN_OFFSET);

export const CursorParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: PaginationLimitSchema,
  direction: z.enum(["forward", "backward"]).optional(),
});

export const OffsetParamsSchema = z.object({
  offset: PaginationOffsetSchema,
  limit: PaginationLimitSchema,
  direction: z.never().optional(),
});

export const PaginationParamsSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("cursor"),
    })
    .merge(CursorParamsSchema),
  z
    .object({
      mode: z.literal("offset"),
    })
    .merge(OffsetParamsSchema),
]);

export const CursorPayloadSchema = z.object({
  v: z.number(),
  id: z.string(),
});

export type CursorParamsInput = z.input<typeof CursorParamsSchema>;
export type CursorParamsOutput = z.output<typeof CursorParamsSchema>;
export type OffsetParamsInput = z.input<typeof OffsetParamsSchema>;
export type OffsetParamsOutput = z.output<typeof OffsetParamsSchema>;
export type PaginationParamsInput = z.input<typeof PaginationParamsSchema>;
export type PaginationParamsOutput = z.output<typeof PaginationParamsSchema>;
export type CursorPayloadInput = z.input<typeof CursorPayloadSchema>;
export type CursorPayloadOutput = z.output<typeof CursorPayloadSchema>;
